import type {
    Outbound,
    StreamSettings,
    XrayJsonConfig,
} from './interfaces/xray-json-config.interface';

const SUPPORTED_NETWORKS = new Set(['tcp', 'ws', 'grpc', 'httpupgrade', 'xhttp', 'kcp']);
const SUPPORTED_SECURITY = new Set(['none', 'tls', 'reality']);

export const convertCustomVlessLinkToXrayJson = (
    link: string,
    templateContent: XrayJsonConfig,
): XrayJsonConfig | null => {
    try {
        const uri = new URL(link);
        if (uri.protocol.toLowerCase() !== 'vless:') return null;

        const id = decodeURIComponent(uri.username);
        const address = uri.hostname;
        const port = Number(uri.port);
        if (!id || !address || !Number.isInteger(port) || port < 1 || port > 65_535) return null;

        const network = (uri.searchParams.get('type') || 'tcp').toLowerCase();
        if (!SUPPORTED_NETWORKS.has(network)) return null;

        const security = (uri.searchParams.get('security') || 'none').toLowerCase();
        if (!SUPPORTED_SECURITY.has(security)) return null;

        const streamSettings: StreamSettings = { network, security };
        const host = uri.searchParams.get('host') || undefined;
        const path = uri.searchParams.get('path') || undefined;

        switch (network) {
            case 'ws':
                streamSettings.wsSettings = { path, host, headers: host ? { Host: host } : {} };
                break;
            case 'grpc':
                streamSettings.grpcSettings = {
                    serviceName: uri.searchParams.get('serviceName') || path,
                    authority: uri.searchParams.get('authority') || host,
                    mode: uri.searchParams.get('mode') === 'multi',
                };
                break;
            case 'httpupgrade':
                streamSettings.httpupgradeSettings = { path, host };
                break;
            case 'xhttp':
                streamSettings.xhttpSettings = {
                    path,
                    host,
                    mode: uri.searchParams.get('mode') || undefined,
                };
                break;
            case 'kcp':
                streamSettings.kcpSettings = {};
                break;
            case 'tcp': {
                const headerType = uri.searchParams.get('headerType');
                if (headerType && headerType !== 'none') {
                    streamSettings.tcpSettings = { header: { type: headerType } };
                }
                break;
            }
        }

        if (security === 'tls') {
            streamSettings.tlsSettings = {
                serverName: uri.searchParams.get('sni') || '',
                ...(uri.searchParams.get('fp') && {
                    fingerprint: uri.searchParams.get('fp'),
                }),
                ...(uri.searchParams.get('alpn') && {
                    alpn: uri.searchParams.get('alpn')?.split(','),
                }),
            };
        }

        if (security === 'reality') {
            streamSettings.realitySettings = {
                serverName: uri.searchParams.get('sni') || '',
                ...(uri.searchParams.get('fp') && {
                    fingerprint: uri.searchParams.get('fp'),
                }),
                ...(uri.searchParams.get('pbk') && {
                    publicKey: uri.searchParams.get('pbk'),
                }),
                ...(uri.searchParams.get('sid') && {
                    shortId: uri.searchParams.get('sid'),
                }),
                ...(uri.searchParams.get('spx') && {
                    spiderX: uri.searchParams.get('spx'),
                }),
            };
        }

        const outbound: Outbound = {
            tag: 'proxy',
            protocol: 'vless',
            settings: {
                vnext: [
                    {
                        address,
                        port,
                        users: [
                            {
                                id,
                                encryption: uri.searchParams.get('encryption') || 'none',
                                ...(uri.searchParams.get('flow') && {
                                    flow: uri.searchParams.get('flow') || undefined,
                                }),
                            },
                        ],
                    },
                ],
            },
            streamSettings,
        };

        const template = { ...templateContent };
        delete template.remnawave;

        let remarks = 'Custom VLESS';
        if (uri.hash.length > 1) {
            try {
                remarks = decodeURIComponent(uri.hash.slice(1));
            } catch {
                remarks = uri.hash.slice(1);
            }
        }

        return {
            ...template,
            outbounds: [outbound, ...(template.outbounds ?? [])],
            remarks,
        };
    } catch {
        return null;
    }
};
