/**
 * Frontend and UI Routes
 * Serves the main Spartan interfaces and static assets
 * (Spartan OS /new/* routes are in spartan-os.routes.ts)
 */

import type { Route, IAgentRuntime } from '@elizaos/core';
import { fs, path, ejs, frontendDist, frontendNewDist, getIndexTemplate, injectBase } from './shared';

export const frontendRoutes: Route[] = [
    // Main Spartan Intel interface
    {
        type: 'GET',
        path: '/degen-intel',
        public: true,
        name: 'Spartan Intel',
        handler: async (_req: any, res: any) => {
            res.sendFile(path.resolve(frontendDist, 'index.html'));
        },
    },

    // Spartan Wallet interface
    {
        type: 'GET',
        path: '/spartan',
        public: true,
        name: 'Spartan Wallet',
        handler: async (req: any, res: any) => {
            const base = req.path;
            console.log('spartan base', base);
            try {
                const filePath = frontendNewDist + '/templates/page.ejs';
                console.log('spartan path', filePath);
                const data = {
                    title: 'Spartan Wallet',
                    page: 'spartan'
                };
                const html = await ejs.renderFile(filePath, data);
                const basedHtml = injectBase(html, base);
                res.type('html').send(basedHtml);
            } catch (e) {
                console.error('spartan error', e);
                res.status(500).send('File not found');
            }
        },
    },

    // Email to UUID converter (utility endpoint)
    {
        type: 'GET',
        path: '/emailToUUID',
        public: true,
        name: 'Email to UUID',
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            console.log('email', req.query.email);
            const { createUniqueUuid } = await import('@elizaos/core');
            const entityId = createUniqueUuid(runtime, req.query.email);
            res.send(entityId);
        },
    },

    // Admin fix/audit endpoint
    {
        type: 'GET',
        path: '/fix',
        handler: async (req: any, res: any, runtime: IAgentRuntime) => {
            const base = '/api/agents/Spartan/plugins/spartan-intel' + req.path;
            console.log('base', base);

            try {
                const { createUniqueUuid } = await import('@elizaos/core');
                const agentEntityId = createUniqueUuid(runtime, runtime.agentId);
                const agentEntity = await runtime.getEntityById(agentEntityId);

                if (!agentEntity || !agentEntity.components) {
                    res.status(500).send('Agent entity not found');
                    return;
                }

                const spartanData = agentEntity.components.find(c => c.type === 'spartan_services');

                if (!spartanData || !spartanData.data) {
                    res.status(500).send('Spartan data not found');
                    return;
                }

                const users = await Promise.all(
                    (spartanData.data.users as string[] || []).map(id => runtime.getEntityById(id as any))
                );
                const accounts = await Promise.all(
                    (spartanData.data.accounts as string[] || []).map(id => runtime.getEntityById(id as any))
                );

                // Audit users
                for (const a of accounts) {
                    if (!a || !a.components) continue;
                    const acctComp = a.components?.find(c => c.type === 'component_account_v0');
                    if (!acctComp) {
                        console.log('no component_account_v0 for', a);
                        continue;
                    }
                    const userId = acctComp.sourceEntityId;
                    if (!(spartanData.data.users as string[]).includes(userId)) {
                        console.log('unlinked account', acctComp, 'was made by', userId);
                    }
                }

                // Audit accounts
                for (const u of users) {
                    if (!u || !u.components) continue;
                    const userComp = u.components?.find(c => c.type === 'component_user_v0');
                    if (!userComp) {
                        console.log('no component_user_v0 for', u);
                        continue;
                    }
                    const userData = userComp.data as any;
                    if (userData.verified) {
                        const emailAddress = userData.address;
                        const emailEntityId = createUniqueUuid(runtime, emailAddress);
                        if ((spartanData.data.accounts as string[] || []).indexOf(emailEntityId) === -1) {
                            console.log('emailEntityId', emailEntityId, 'is missing for', emailAddress);
                            (spartanData.data.accounts as string[]).push(emailEntityId);
                        }
                    }
                }

                res.json({
                    spartanData: spartanData ? { ...spartanData, data: spartanData.data } : null,
                    users: users.filter(u => u !== null),
                    accounts: accounts.filter(a => a !== null),
                });
            } catch (e) {
                console.error('e', e);
                res.status(500).send('File not found');
            }
        },
    },

    // Root path
    {
        type: 'GET',
        path: '/',
        handler: async (req: any, res: any) => {
            console.log('path', req.path, 'url', req.url);
            const base = req.path;
            try {
                const template = await getIndexTemplate();
                const html = injectBase(template, base);
                res.type('html').send(html);
            } catch (e) {
                console.error('e', e);
            }
        },
    },

    // Static assets
    {
        type: 'GET',
        path: '/assets/*',
        handler: async (req: any, res: any) => {
            const assetPath = `/dist/assets/${req.path.split('/assets/')[1]}`;
            const cwd = process.cwd();
            const filePath = cwd + path.resolve(cwd, assetPath);
            console.log('filePath', filePath);
            if (fs.existsSync(path.resolve(filePath))) {
                res.sendFile(filePath);
            } else {
                res.status(404).send('File not found');
            }
        },
    },

    // Logo assets
    {
        type: 'GET',
        path: '/logos/*',
        handler: async (req: any, res: any) => {
            const assetPart = req.path.split('/logos/')[1];
            if (!assetPart) {
                return res.status(404).send('Asset not specified');
            }

            const filePath = path.join(
                frontendDist,
                '..',
                'src',
                'investmentManager',
                'plugins',
                'degen-intel',
                'frontend',
                'logos',
                assetPart
            );
            console.log('filePath', filePath);

            if (fs.existsSync(filePath)) {
                res.sendFile(filePath);
            } else {
                res.status(404).send('File not found');
            }
        },
    },
];
