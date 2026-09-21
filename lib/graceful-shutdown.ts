export interface ShutdownCoordinator {
  readonly shutdown: () => Promise<void>;
  readonly installSignals: () => () => void;
  readonly started: () => boolean;
}

export interface ShutdownCoordinatorOptions {
  readonly stopWorker?: () => void;
  readonly waitForTick?: () => Promise<unknown>;
  readonly closeLease?: () => Promise<void>;
  readonly closeServer: () => Promise<void>;
  readonly logger?: (message: string, error?: unknown) => void;
}

export function createShutdownCoordinator(
  options: ShutdownCoordinatorOptions
): ShutdownCoordinator {
  let promise: Promise<void> | null = null;
  let started = false;

  const logger = options.logger ?? ((message, error) => {
    if (error) console.error(message, error);
    else console.error(message);
  });

  const shutdown = (): Promise<void> => {
    if (promise) return promise;
    started = true;
    promise = (async () => {
      options.stopWorker?.();
      const serverClose = options.closeServer();

      if (options.waitForTick) {
        try {
          await options.waitForTick();
        } catch (error) {
          logger('Hafize schedule tick shutdown failed', error);
        }
      }

      if (options.closeLease) {
        try {
          await options.closeLease();
        } catch (error) {
          logger('Hafize schedule lease shutdown failed', error);
          process.exitCode = 1;
        }
      }

      try {
        await serverClose;
      } catch (error) {
        logger('Hafize HTTP server shutdown failed', error);
        process.exitCode = 1;
      }
    })();
    return promise;
  };

  const installSignals = (): (() => void) => {
    const onInterrupt = (): void => { void shutdown(); };
    const onTerminate = (): void => { void shutdown(); };
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);
    return () => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
    };
  };

  return Object.freeze({
    shutdown,
    installSignals,
    started: () => started
  });
}
