import { Category, CategoryTreeNode } from '../models/category.model';

export interface IndentedCategory {
  category: Category;
  depth: number;
}

// Un padre ausente deja la categoría como raíz para no perderla de la vista.
export function buildCategoryTree(
  categories: readonly Category[],
): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortByName(roots);
  return roots;
}

export function listCategoriesInTreeOrder(
  categories: readonly Category[],
): IndentedCategory[] {
  const result: IndentedCategory[] = [];
  const visit = (nodes: CategoryTreeNode[], depth: number): void => {
    for (const node of nodes) {
      result.push({ category: node, depth });
      visit(node.children, depth + 1);
    }
  };
  visit(buildCategoryTree(categories), 0);
  return result;
}

// Incluye la propia categoría y todos sus descendientes.
export function collectSubtreeIds(
  categories: readonly Category[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId) {
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }
  }

  const subtree = new Set<string>([rootId]);
  const pending = [rootId];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!subtree.has(childId)) {
        subtree.add(childId);
        pending.push(childId);
      }
    }
  }
  return subtree;
}

function sortByName(nodes: CategoryTreeNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const node of nodes) {
    sortByName(node.children);
  }
}
