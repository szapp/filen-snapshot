interface FilenSnapshotParams {
    email: string;
    password: string;
    twoFactorCode?: string;
    twoFactorSecret?: string;
    localPath?: string;
    source: string[];
    destination: string;
    snapshotName?: string;
}
export default function createSnapshot(params: FilenSnapshotParams | string): Promise<void>;
export {};
