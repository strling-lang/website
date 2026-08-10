interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * Markdown tables can overflow their reading column on small screens. Making
 * the table itself focusable lets keyboard users scroll the region.
 */
export default function rehypeAccessibleTables() {
  return (tree: HastNode) => {
    const visit = (node: HastNode): void => {
      if (node.type === 'element' && node.tagName === 'table') {
        node.properties = { ...node.properties, tabIndex: 0 };
      }
      node.children?.forEach(visit);
    };

    visit(tree);
  };
}
