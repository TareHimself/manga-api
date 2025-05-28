export function isDebug(){
    return process.argv.includes("--debug");
}