/** Read input from stdin if `s === "-"`, otherwise return as-is. */
export async function readInput(s: string): Promise<string> {
  if (s === "-") {
    const chunks: Buffer[] = [];
    return new Promise<string>((resolve, reject) => {
      process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
      process.stdin.on("end", () =>
        resolve(Buffer.concat(chunks).toString("utf8").trim()),
      );
      process.stdin.on("error", reject);
    });
  }
  return s;
}
