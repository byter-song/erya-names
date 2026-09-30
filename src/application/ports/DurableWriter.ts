export interface DurableWriter {
  flush(): Promise<void>;
}
