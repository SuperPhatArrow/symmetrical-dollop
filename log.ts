export const setupLog = (debug: boolean) => {
    return (...args: any) => {
        if (debug) console.log(`${new Date().toISOString().replace("T", " ")} - \n`, ...args);
      }
}