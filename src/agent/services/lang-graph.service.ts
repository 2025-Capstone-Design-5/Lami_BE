import { Injectable } from '@nestjs/common';

interface GraphNode {
  id: string;
  content: string;
  timestamp: Date;
}

@Injectable()
export class LangGraphService {
  private memories = new Map<
    string,
    {
      nodes: GraphNode[];
      edges: { from: string; to: string; label?: string }[];
    }
  >();

  private getGraph(userId: string) {
    if (!this.memories.has(userId)) {
      this.memories.set(userId, { nodes: [], edges: [] });
    }
    return this.memories.get(userId)!;
  }

  addNode(userId: string, content: string): string {
    const graph = this.getGraph(userId);
    const nodeId = `node_${graph.nodes.length + 1}`;
    graph.nodes.push({ id: nodeId, content, timestamp: new Date() });
    if (graph.nodes.length > 1) {
      const prevId = graph.nodes[graph.nodes.length - 2].id;
      graph.edges.push({ from: prevId, to: nodeId });
    }
    return nodeId;
  }

  /**
   * Get all nodes for a user
   */
  getNodes(userId: string) {
    return this.getGraph(userId).nodes;
  }

  /**
   * Clear all memory for a user (nodes and edges)
   */
  clearMemory(userId: string) {
    this.memories.set(userId, { nodes: [], edges: [] });
  }

  /**
   * Serialize nodes to a prompt string
   */
  toPrompt(userId: string): string {
    const graph = this.getGraph(userId);
    // Return only the stored content strings for memory context
    return graph.nodes.map((n) => n.content).join('\n');
  }
}
