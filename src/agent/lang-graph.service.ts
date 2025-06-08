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

  toPrompt(userId: string): string {
    const graph = this.getGraph(userId);
    return graph.nodes
      .map((n) => `${n.id} (${n.timestamp.toISOString()}): ${n.content}`)
      .join('\n');
  }
}
