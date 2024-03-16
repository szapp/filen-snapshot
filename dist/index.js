"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cli_progress_1 = __importDefault(require("cli-progress"));
const sdk_1 = __importDefault(require("@filen/sdk"));
const fs_1 = __importDefault(require("fs"));
const luxon_1 = require("luxon");
const OTPAuth = __importStar(require("otpauth"));
const path_1 = require("path");
function formatPath(path) {
    return path_1.posix.normalize(path.split(path_1.sep).join(path_1.posix.sep));
}
async function createSnapshot(params) {
    // Load parameters from JSON file
    if (typeof params === 'string')
        params = JSON.parse(fs_1.default.readFileSync(params, { encoding: 'utf-8' }));
    // Format paths
    const source = params.source.map((path) => formatPath(path));
    const destDir = formatPath(params.destination);
    const snapshotName = formatPath(luxon_1.DateTime.now().toFormat(params.snapshotName || 'yyyy-MM-dd_HH-mm-ss'));
    const destination = formatPath(path_1.posix.join(destDir, snapshotName));
    const localPath = params.localPath ? formatPath(params.localPath) : undefined;
    // Verfiy source paths
    source.forEach((path) => {
        if (path.startsWith(destDir))
            throw new Error(`Source path '${path}' is within the destination directory '${destDir}'`);
    });
    let maxLength = 0;
    for (let idx = 0; idx < source.length; idx++) {
        const path = source[idx];
        maxLength = Math.max(maxLength, path_1.posix.basename(path).length + 2);
        for (let jdx = idx + 1; jdx < source.length; jdx++) {
            const other = source[jdx];
            if (path.startsWith(other) || other.startsWith(path))
                throw new Error(`Source paths '${path}' and '${other}' overlap`);
        }
    }
    // Create a new Filen SDK instance
    const filen = new sdk_1.default({
        metadataCache: true,
    });
    // Create progress bars
    const multibar = new cli_progress_1.default.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        autopadding: true,
        format: '{source} {bar} {percentage}% {eta_formatted}',
    }, cli_progress_1.default.Presets.shades_classic);
    // Login and copy files
    try {
        await filen.login({
            email: params.email,
            password: params.password,
            twoFactorCode: params.twoFactorCode
                ? params.twoFactorCode
                : params.twoFactorSecret
                    ? new OTPAuth.TOTP({ secret: params.twoFactorSecret }).generate()
                    : undefined,
        });
        // Abort all uploads if one fails
        const abortAll = new AbortController();
        // Copy each source to destination asynchronously
        const promises = [];
        for (const path of source) {
            // Check if it is a directory and get total size
            const { uuid, isDirectory } = await filen.fs().stat({ path });
            if (!isDirectory)
                throw new Error(`Source path '${path}' is not a directory`); // Only support directories for deterministic progress
            const { size } = await filen.api(3).dir().size({ uuid });
            // Check if the source path is available locally (for faster uploads)
            const isLocal = typeof localPath !== 'undefined' && fs_1.default.existsSync(path_1.posix.join(localPath, path));
            // Create progress bar (indicate with L or C if local or cloud, respectively)
            const progressName = ((isLocal ? 'L ' : 'C ') + path_1.posix.basename(path)).padEnd(maxLength, ' ');
            const progressBar = multibar.create(size, 0, { source: progressName });
            const progressFunc = (transfered) => progressBar.increment(transfered);
            // If the source is local, upload the directory (faster), otherwise copy it (slower, because if first downloads and then uploads)
            let job;
            if (isLocal) {
                const totalPath = path_1.posix.join(localPath, path);
                // Create parent directories to get UUID
                const parents = path_1.posix.dirname(path);
                const parentUUID = await filen.fs().mkdir({ path: path_1.posix.join(destination, parents) });
                // Upload local directory, nested into parent directories
                job = filen.cloud().uploadLocalDirectory({
                    source: totalPath,
                    parent: parentUUID,
                    onProgress: progressFunc,
                    abortSignal: abortAll.signal,
                });
            }
            else {
                job = filen.fs().copy({
                    from: path,
                    to: path_1.posix.join(destination, path),
                    onProgress: progressFunc,
                    abortSignal: abortAll.signal,
                });
            }
            promises.push(job);
        }
        // Wait for all copies to finish
        await Promise.all(promises).catch(abortAll.abort);
    }
    finally {
        multibar.stop();
        filen.logout();
        filen.clearTemporaryDirectory();
    }
    // Log success
    console.log(`\nSnapshot created at '${destination}'`);
}
exports.default = createSnapshot;
module.exports = createSnapshot;
//# sourceMappingURL=index.js.map