const FILE_REFERENCE_ERROR =
    'certificateFile and keyFile are not allowed in API-supplied configs. ' +
    'Provide inline certificate and key arrays instead.';

export function assertInlineCertificatesOnly(certificates: readonly unknown[]): void {
    for (const certificate of certificates) {
        if (!certificate || typeof certificate !== 'object') continue;

        const candidate = certificate as Record<string, unknown>;
        if (candidate.certificateFile || candidate.keyFile) {
            throw new Error(FILE_REFERENCE_ERROR);
        }
    }
}
