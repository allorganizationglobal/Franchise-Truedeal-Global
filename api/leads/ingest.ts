import type { IncomingMessage, ServerResponse } from 'http';
import { ingestLeadToCrm } from '../../src/server/leadService';

/**
 * Vercel Serverless Function: POST /api/leads/ingest
 * Securely forwards validated customer leads to TRUEDEAL GLOBAL CRM
 */
export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Handle CORS preflight if needed
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(
      JSON.stringify({
        success: false,
        statusCode: 405,
        status: 'validation_error',
        message: 'Method Not Allowed. Use POST.'
      })
    );
  }

  // Read request body (handles both Express/Vercel parsed body and raw streams)
  let body = req.body;
  if (!body) {
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawText = Buffer.concat(chunks).toString('utf8');
      body = JSON.parse(rawText);
    } catch {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          success: false,
          statusCode: 400,
          status: 'validation_error',
          message: 'Malformed JSON payload in request body.'
        })
      );
    }
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          success: false,
          statusCode: 400,
          status: 'validation_error',
          message: 'Malformed JSON payload string.'
        })
      );
    }
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  try {
    const result = await ingestLeadToCrm(body, clientIp);
    res.statusCode = result.statusCode;
    return res.end(JSON.stringify(result));
  } catch (err: any) {
    console.error('[API /api/leads/ingest] Uncaught error:', err);
    res.statusCode = 500;
    return res.end(
      JSON.stringify({
        success: false,
        statusCode: 500,
        status: 'crm_error',
        message: 'Internal server error while processing franchise enquiry.'
      })
    );
  }
}
