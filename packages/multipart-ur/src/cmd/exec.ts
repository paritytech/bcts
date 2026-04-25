/** Port of `bc-mur::main::exec`. */
export interface Exec {
  exec(): Promise<string>;
}
