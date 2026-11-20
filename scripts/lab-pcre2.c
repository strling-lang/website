/* Browser Lab bridge for the PCRE2 8-bit interpreter. */
#define PCRE2_CODE_UNIT_WIDTH 8
#include <pcre2.h>
#include <stdint.h>

#define EXPORT(name) __attribute__((export_name(name)))
#define MAX_PATTERN (8192 * 3)
#define MAX_SUBJECT (32768 * 3)
#define MAX_REPLACEMENT (2048 * 3)
#define MAX_OUTPUT (524288)
#define MAX_CAPTURES 128
#define CAPTURE_LIMIT (-1001)
#define OUTPUT_LIMIT (-1002)

static unsigned char pattern[MAX_PATTERN], subject[MAX_SUBJECT];
static unsigned char replacement[MAX_REPLACEMENT], output[MAX_OUTPUT];
static unsigned char message[256];
static uint32_t offsets[(MAX_CAPTURES + 1) * 2];
static PCRE2_SIZE error_offset, next_start, output_size;
static uint32_t next_options, capture_count, trace_count, trace_slots;
static int substitution_limit;
#if PCRE2_MINOR < 46
static size_t last_length;
static uint32_t newline;
#endif
static pcre2_code *code;
static pcre2_match_data *data;
static pcre2_match_context *context;

/* The only Lab host callback receives positions and a bounded capture vector. */
__attribute__((import_module("lab"), import_name("record")))
extern void record(uint32_t number, uint32_t flags, uint32_t pattern_pos,
                   uint32_t item_length, uint32_t subject_pos, uint32_t start,
                   uint32_t capture_top, uint32_t capture_last,
                   const PCRE2_SIZE *capture_vector);

static int trace_event(pcre2_callout_block *block, void *unused) {
    (void)unused;
    trace_slots += block->capture_top;
    if (trace_count++ >= 512 || trace_slots > 4096) return PCRE2_ERROR_CALLOUT;
    record(block->callout_number, block->callout_flags, block->pattern_position,
           block->next_item_length, block->current_position, block->start_match,
           block->capture_top, block->capture_last, block->offset_vector);
    return 0;
}

static int count_substitutions(pcre2_substitute_callout_block *block, void *unused) {
    (void)unused;
    if (block->subscount <= 256) return 0;
    substitution_limit = 1;
    return -1;
}

EXPORT("reset") void reset(void) {
    pcre2_match_context_free(context);
    pcre2_match_data_free(data);
    pcre2_code_free(code);
    context = NULL;
    data = NULL;
    code = NULL;
    error_offset = 0;
    capture_count = 0;
    trace_count = 0;
    trace_slots = 0;
}

EXPORT("compile") int compile(size_t length, uint32_t flags, int trace, int any_newline) {
    reset();
    if (length > MAX_PATTERN) return PCRE2_ERROR_BADDATA;
    int error;
    uint32_t options = PCRE2_NEVER_BACKSLASH_C | PCRE2_UTF | flags;
    if (trace) options |= PCRE2_AUTO_CALLOUT | PCRE2_NO_AUTO_POSSESS | PCRE2_NO_START_OPTIMIZE;
    pcre2_compile_context *compile_context = pcre2_compile_context_create(NULL);
    if (!compile_context) return PCRE2_ERROR_NOMEMORY;
    if (any_newline) {
        pcre2_set_newline(compile_context, PCRE2_NEWLINE_ANY);
#if PCRE2_MINOR >= 43
        pcre2_set_max_varlookbehind(compile_context, 255);
#endif
    }
    code = pcre2_compile(pattern, length, options, &error, &error_offset, compile_context);
    pcre2_compile_context_free(compile_context);
    if (!code) return error;
    pcre2_pattern_info(code, PCRE2_INFO_CAPTURECOUNT, &capture_count);
    if (capture_count > MAX_CAPTURES) return CAPTURE_LIMIT;
    data = pcre2_match_data_create_from_pattern(code, NULL);
    context = pcre2_match_context_create(NULL);
    if (!data || !context) return PCRE2_ERROR_NOMEMORY;
    pcre2_set_match_limit(context, 150000);
    pcre2_set_depth_limit(context, 1000);
    pcre2_set_heap_limit(context, 4096);
#if PCRE2_MINOR < 46
    pcre2_pattern_info(code, PCRE2_INFO_NEWLINE, &newline);
#endif
    if (trace) pcre2_set_callout(context, trace_event, NULL);
    return 0;
}

EXPORT("match") int match(size_t length, size_t start, uint32_t options) {
    if (length > MAX_SUBJECT || !data || !context) return PCRE2_ERROR_BADDATA;
    int result = pcre2_match(code, subject, length, start, options, data, context);
#if PCRE2_MINOR < 46
    /* PCRE2 10.43 documents an anchored nonempty retry after an empty match. */
    last_length = length;
    if (result == PCRE2_ERROR_NOMATCH && (options & PCRE2_NOTEMPTY_ATSTART) && start < length) {
        int crlf_newline = newline == PCRE2_NEWLINE_ANY || newline == PCRE2_NEWLINE_ANYCRLF || newline == PCRE2_NEWLINE_CRLF;
        if (crlf_newline && subject[start] == '\r' && start + 1 < length && subject[start + 1] == '\n') {
            start += 2;
        } else {
            do { ++start; } while (start < length && (subject[start] & 0xc0) == 0x80);
        }
        result = pcre2_match(code, subject, length, start, 0, data, context);
    }
#endif
    if (result > 0) {
        const PCRE2_SIZE *vector = pcre2_get_ovector_pointer(data);
        for (uint32_t i = 0; i < (capture_count + 1) * 2; ++i)
            offsets[i] = i < (uint32_t)result * 2 ? vector[i] : UINT32_MAX;
    }
    return result;
}

EXPORT("next") int next(void) {
#if PCRE2_MINOR >= 46
    return pcre2_next_match(data, &next_start, &next_options);
#else
    next_start = offsets[1];
    next_options = 0;
    if (offsets[0] == offsets[1]) {
        if (next_start >= last_length) return 0;
        next_options = PCRE2_NOTEMPTY_ATSTART | PCRE2_ANCHORED;
    }
    return 1;
#endif
}

EXPORT("substitute") int substitute(size_t length, size_t replacement_length, uint32_t options) {
    if (length > MAX_SUBJECT || replacement_length > MAX_REPLACEMENT || !data || !context)
        return PCRE2_ERROR_BADDATA;
    output_size = sizeof(output);
    substitution_limit = 0;
    pcre2_set_substitute_callout(context, count_substitutions, NULL);
    int count = pcre2_substitute(code, subject, length, 0, options, data, context,
                                 replacement, replacement_length, output, &output_size);
    return substitution_limit || (count == PCRE2_ERROR_NOMEMORY && output_size == PCRE2_UNSET)
        ? OUTPUT_LIMIT : count;
}

EXPORT("version") int version(void) { return pcre2_config(PCRE2_CONFIG_VERSION, message); }
EXPORT("explain_error") int explain_error(int error) {
    return pcre2_get_error_message(error, message, sizeof(message));
}
EXPORT("names") const void *names(void) {
    PCRE2_SPTR table = NULL;
    pcre2_pattern_info(code, PCRE2_INFO_NAMETABLE, &table);
    return table;
}
EXPORT("name_count") uint32_t name_count(void) {
    uint32_t count = 0;
    pcre2_pattern_info(code, PCRE2_INFO_NAMECOUNT, &count);
    return count;
}
EXPORT("name_size") uint32_t name_size(void) {
    uint32_t size = 0;
    pcre2_pattern_info(code, PCRE2_INFO_NAMEENTRYSIZE, &size);
    return size;
}
EXPORT("pattern_buffer") void *pattern_buffer(void) { return pattern; }
EXPORT("subject_buffer") void *subject_buffer(void) { return subject; }
EXPORT("replacement_buffer") void *replacement_buffer(void) { return replacement; }
EXPORT("output_buffer") const void *output_buffer(void) { return output; }
EXPORT("message_buffer") const void *message_buffer(void) { return message; }
EXPORT("offset_buffer") const void *offset_buffer(void) { return offsets; }
EXPORT("error_offset") size_t get_error_offset(void) { return error_offset; }
EXPORT("output_size") size_t get_output_size(void) { return output_size; }
EXPORT("next_start") size_t get_next_start(void) { return next_start; }
EXPORT("next_options") uint32_t get_next_options(void) { return next_options; }
EXPORT("capture_count") uint32_t get_capture_count(void) { return capture_count; }
