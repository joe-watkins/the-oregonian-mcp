import { tools } from '../../src/tools.js';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'the-oregonian-mcp';
const SERVER_VERSION = '1.0.0';

/**
 * Stateless JSON-RPC 2.0 handler for MCP over Netlify Functions.
 */
async function handleJsonRpcRequest(req) {
  const { method, params, id } = req;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };

    case 'tools/call': {
      const tool = tools.find((t) => t.name === params?.name);
      if (!tool) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Unknown tool: ${params?.name}` },
        };
      }
      try {
        const result = await tool.handler(params.arguments || {});
        return { jsonrpc: '2.0', id, result };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          },
        };
      }
    }

    case 'notifications/initialized':
      return null; // No response for notifications

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

export default async function handler(req, context) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // Health check
  if (req.method === 'GET') {
    return Response.json({
      status: 'ok',
      server: SERVER_NAME,
      version: SERVER_VERSION,
      protocol: PROTOCOL_VERSION,
    });
  }

  // JSON-RPC handler
  if (req.method === 'POST') {
    const body = await req.json();

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(body.map(handleJsonRpcRequest));
      const responses = results.filter((r) => r !== null);
      return Response.json(responses, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const result = await handleJsonRpcRequest(body);
    if (result === null) {
      return new Response(null, { status: 204 });
    }
    return Response.json(result, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return Response.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export const config = {
  path: '/api',
};
