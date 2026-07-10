export type Resolve<T> = (value: T | PromiseLike<T>) => void;
export type Reject = (reason?: unknown) => void;

/** Lets lifecycle code outside the executor settle a promise exactly once. */
export class ControlledPromise<T> {
  readonly promise: Promise<T>;
  settled = false;
  resolve!: Resolve<T>;
  reject!: Reject;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = (value) => {
        if (this.settled) {
          return;
        }
        this.settled = true;
        resolve(value);
      };
      this.reject = (reason) => {
        if (this.settled) {
          return;
        }
        this.settled = true;
        reject(reason);
      };
    });
  }
}
