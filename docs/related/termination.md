# Terminating the session

**scran.js** automatically spins up multiple web workers depending on the number of threads requested in `scran.initialize()`.
On Node.js, it is necessary to terminate the workers after all analyses are complete.
This is achieved by calling `scran.terminate()` once all analysis operations are finished.
Otherwise, the Node.js process will hang indefinitely as it waits for the workers to return.

Browsers usually do not have this problem as the session ends when a user closes the relevant tab. 
Nonetheless, developers may choose to use `terminate()` to shut down **scran.js** if it is no longer needed.
Obviously, this means that any objects dependent on the Wasm heap (e.g., `*Results` instances, `ScranMatrix` objects) will be invalidated.
