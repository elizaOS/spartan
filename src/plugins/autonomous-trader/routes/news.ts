// @ts-nocheck
import type { IAgentRuntime, Route } from '@elizaos/core';
import type { SpartanNewsService } from '../services/spartanNewsService';

function sendJson(res: any, status: number, payload: unknown) {
  if (typeof res.status === 'function') {
    res.status(status).json(payload);
    return;
  }

  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function sendError(res: any, status: number, message: string) {
  sendJson(res, status, {
    success: false,
    error: message,
  });
}

export const newsRoutes: Route[] = [
  {
    type: 'GET',
    path: '/news',
    public: true,
    name: 'List Spartan News',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const service = runtime.getService('SPARTAN_NEWS_SERVICE') as SpartanNewsService | undefined;
        if (!service) {
          return sendError(res, 503, 'Spartan news service unavailable');
        }

        const query = (req?.query ?? {}) as Record<string, unknown>;
        const limitValue = query.limit;
        const limitRaw = typeof limitValue === 'string' ? limitValue : Array.isArray(limitValue) ? limitValue[0] : undefined;
        const limit = Math.max(1, Math.min(25, Number.parseInt(limitRaw ?? '10', 10) || 10));
        const articles = await service.getRecentArticles(limit);

        sendJson(res, 200, {
          success: true,
          data: articles.map((article) => ({
            id: article.id,
            title: article.title,
            summary: article.summary,
            body: article.body,
            category: article.category,
            timeFrame: article.timeFrame,
            limit: article.limit,
            createdAt: article.createdAt,
            metadata: article.metadata,
          })),
        });
      } catch (error) {
        runtime.logger.error('[SpartanNewsRoutes] Failed to list news articles', error);
        sendError(res, 500, 'Failed to list Spartan news');
      }
    },
  },
  {
    type: 'GET',
    path: '/news/latest',
    public: true,
    name: 'Latest Spartan News',
    handler: async (_req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const service = runtime.getService('SPARTAN_NEWS_SERVICE') as SpartanNewsService | undefined;
        if (!service) {
          return sendError(res, 503, 'Spartan news service unavailable');
        }

        const [article] = await service.getRecentArticles(1);
        if (!article) {
          return sendJson(res, 200, { success: true, data: null });
        }

        sendJson(res, 200, {
          success: true,
          data: {
            id: article.id,
            title: article.title,
            summary: article.summary,
            body: article.body,
            category: article.category,
            timeFrame: article.timeFrame,
            limit: article.limit,
            createdAt: article.createdAt,
            metadata: article.metadata,
          },
        });
      } catch (error) {
        runtime.logger.error('[SpartanNewsRoutes] Failed to fetch latest news article', error);
        sendError(res, 500, 'Failed to fetch latest Spartan news');
      }
    },
  },
  {
    type: 'GET',
    path: '/news/:id',
    public: true,
    name: 'Get Spartan News Article',
    handler: async (req: any, res: any, runtime: IAgentRuntime) => {
      try {
        const service = runtime.getService('SPARTAN_NEWS_SERVICE') as SpartanNewsService | undefined;
        if (!service) {
          return sendError(res, 503, 'Spartan news service unavailable');
        }

        const params = (req?.params ?? {}) as Record<string, unknown>;
        const idValue = params.id;
        const id = typeof idValue === 'string' ? idValue : undefined;
        if (!id) {
          return sendError(res, 400, 'Missing article id');
        }

        const article = await service.getArticleById(id);
        if (!article) {
          return sendError(res, 404, 'Article not found');
        }

        sendJson(res, 200, {
          success: true,
          data: {
            id: article.id,
            title: article.title,
            summary: article.summary,
            body: article.body,
            category: article.category,
            timeFrame: article.timeFrame,
            limit: article.limit,
            createdAt: article.createdAt,
            metadata: article.metadata,
          },
        });
      } catch (error) {
        runtime.logger.error('[SpartanNewsRoutes] Failed to fetch news article', error);
        sendError(res, 500, 'Failed to fetch Spartan news article');
      }
    },
  },
];


