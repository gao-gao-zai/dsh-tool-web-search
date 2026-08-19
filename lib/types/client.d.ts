interface SettingsPluginItemOwnerProps {
    children?: never;
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
        'settings.plugin.item': {
            kind: 'keyed';
            scope: 'root';
            keyProps: Record<string, object>;
        };
    }
}
export declare const inject: string[];
export declare function apply(ctx: any): void;
export {};
//# sourceMappingURL=client.d.ts.map