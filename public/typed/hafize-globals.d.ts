// Ambient browser contracts for the Hafize frontend.
// Each browser module publishes a small namespace on `window` and communicates
// through `hafize:*` CustomEvents; these declarations let the browser typecheck
// (`npm run typecheck:browser`) see both without weakening module boundaries.

/** Loose view of a browser namespace published on `window` by a Hafize module. */
type HafizeBrowserNamespace = Record<string, any>;

declare global {
  /** Any interactive control whose `.value` the browser modules read or write. */
  type HafizeValueControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  /** A focusable control inside a dialog focus trap. */
  type HafizeFocusable = HTMLElement & { disabled?: boolean };

  interface Window {
    HafizeChatMarkdown?: HafizeBrowserNamespace;
    HafizeComposerHistory?: HafizeBrowserNamespace;
    HafizeComposerHistoryBackup?: HafizeBrowserNamespace;
    HafizeComposerHistoryController?: HafizeBrowserNamespace;
    HafizeComposerHistoryHelp?: HafizeBrowserNamespace;
    HafizeComposerHistoryPanel?: HafizeBrowserNamespace;
    HafizeComposerHistorySettings?: HafizeBrowserNamespace;
    HafizeConnectorHub?: HafizeBrowserNamespace;
    HafizeConnectorHubController?: HafizeBrowserNamespace;
    HafizeConversationForks?: HafizeBrowserNamespace;
    HafizeConversationWorkspace?: HafizeBrowserNamespace;
    HafizeConversationWorkspaceKeyboard?: HafizeBrowserNamespace;
    HafizeGitHubWorkspace?: HafizeBrowserNamespace;
    HafizeGitHubWorkspaceActions?: HafizeBrowserNamespace;
    HafizeGitHubWorkspaceDetails?: HafizeBrowserNamespace;
    HafizeGitHubWorkspaceExtra?: HafizeBrowserNamespace;
    HafizeGitHubWorkspaceWrite?: HafizeBrowserNamespace;
    HafizeHandsFree?: HafizeBrowserNamespace;
    HafizeHandsFreeBackgroundGuard?: HafizeBrowserNamespace;
    HafizeMarkdown?: HafizeBrowserNamespace;
    HafizeMessageWorkspacePolicy?: HafizeBrowserNamespace;
    HafizePrivacyCenter?: HafizeBrowserNamespace;
    HafizePromptLibrary?: HafizeBrowserNamespace;
    HafizePromptLibraryBulkOrganizer?: HafizeBrowserNamespace;
    HafizePromptLibraryCollections?: HafizeBrowserNamespace;
    HafizePromptLibraryDiagnostics?: HafizeBrowserNamespace;
    HafizePromptLibraryImportPreview?: HafizeBrowserNamespace;
    HafizePromptLibraryRevisions?: HafizeBrowserNamespace;
    HafizePromptLibrarySafety?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartFill?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsert?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertActivity?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertCenter?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertHistory?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertPresets?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertShortcuts?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertSuggestions?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartInsertValidation?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartViewBuilder?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartViews?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartViewsHistory?: HafizeBrowserNamespace;
    HafizePromptLibrarySmartViewsSafety?: HafizeBrowserNamespace;
    HafizePromptLibraryStarters?: HafizeBrowserNamespace;
    HafizePromptLibraryUsage?: HafizeBrowserNamespace;
    HafizePromptSmartFillHints?: HafizeBrowserNamespace;
    HafizeScreenShare?: HafizeBrowserNamespace;
    HafizeSettingsWorkspace?: HafizeBrowserNamespace;
    HafizeWorkspaceNavigation?: HafizeBrowserNamespace;
  }

  interface WindowEventMap {
    'hafize:composer-history-changed': CustomEvent<Record<string, any>>;
    'hafize:composer-history-settings-changed': CustomEvent<Record<string, any>>;
    'hafize:connector-hub-changed': CustomEvent<Record<string, any>>;
    'hafize:conversation-forks-changed': CustomEvent<Record<string, any>>;
    'hafize:conversation-workspace-changed': CustomEvent<Record<string, any>>;
    'hafize:edit-message': CustomEvent<Record<string, any>>;
    'hafize:hands-free-revoke': CustomEvent<Record<string, any>>;
    'hafize:message-workspace-changed': CustomEvent<Record<string, any>>;
    'hafize:model-preferences-changed': CustomEvent<Record<string, any>>;
    'hafize:open-conversation': CustomEvent<Record<string, any>>;
    'hafize:privacy-data-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-command-inserted': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-collections-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-refresh': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-safety-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-insert-history-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-view-applied': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-view-history-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-views-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-views-repaired': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-state-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-dialog': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-presets-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-profiles-changed': CustomEvent<Record<string, any>>;
    'hafize:runtime-ready': CustomEvent<Record<string, any>>;
    'hafize:schedule-lease': CustomEvent<Record<string, any>>;
    'hafize:scheduled-preview-activity': CustomEvent<Record<string, any>>;
    'hafize:scheduled-task-templates-changed': CustomEvent<Record<string, any>>;
    'hafize:scheduled-tasks-close': CustomEvent<Record<string, any>>;
    'hafize:scheduled-tasks-open': CustomEvent<Record<string, any>>;
    'hafize:screen-capture-ready': CustomEvent<Record<string, any>>;
    'hafize:voice-input-state': CustomEvent<Record<string, any>>;
    'hafize:voice-output-state': CustomEvent<Record<string, any>>;
    'hafize:workspace-backup-restored': CustomEvent<Record<string, any>>;
    'hafize:workspace-changed': CustomEvent<Record<string, any>>;
  }

  interface DocumentEventMap {
    'hafize:composer-history-changed': CustomEvent<Record<string, any>>;
    'hafize:composer-history-settings-changed': CustomEvent<Record<string, any>>;
    'hafize:connector-hub-changed': CustomEvent<Record<string, any>>;
    'hafize:conversation-forks-changed': CustomEvent<Record<string, any>>;
    'hafize:conversation-workspace-changed': CustomEvent<Record<string, any>>;
    'hafize:edit-message': CustomEvent<Record<string, any>>;
    'hafize:hands-free-revoke': CustomEvent<Record<string, any>>;
    'hafize:message-workspace-changed': CustomEvent<Record<string, any>>;
    'hafize:model-preferences-changed': CustomEvent<Record<string, any>>;
    'hafize:open-conversation': CustomEvent<Record<string, any>>;
    'hafize:privacy-data-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-command-inserted': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-collections-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-refresh': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-safety-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-insert-history-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-view-applied': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-view-history-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-views-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-smart-views-repaired': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-state-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-dialog': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-presets-changed': CustomEvent<Record<string, any>>;
    'hafize:prompt-library-variable-profiles-changed': CustomEvent<Record<string, any>>;
    'hafize:runtime-ready': CustomEvent<Record<string, any>>;
    'hafize:schedule-lease': CustomEvent<Record<string, any>>;
    'hafize:scheduled-preview-activity': CustomEvent<Record<string, any>>;
    'hafize:scheduled-task-templates-changed': CustomEvent<Record<string, any>>;
    'hafize:scheduled-tasks-close': CustomEvent<Record<string, any>>;
    'hafize:scheduled-tasks-open': CustomEvent<Record<string, any>>;
    'hafize:screen-capture-ready': CustomEvent<Record<string, any>>;
    'hafize:voice-input-state': CustomEvent<Record<string, any>>;
    'hafize:voice-output-state': CustomEvent<Record<string, any>>;
    'hafize:workspace-backup-restored': CustomEvent<Record<string, any>>;
    'hafize:workspace-changed': CustomEvent<Record<string, any>>;
  }
}


export {};
