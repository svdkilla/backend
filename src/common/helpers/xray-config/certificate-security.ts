import { posix } from 'node:path';

const MAX_CERTIFICATE_PATH_LENGTH = 4_096;
const CERTIFICATE_FILE_PATTERN = /\.(?:cer|crt|pem)$/iu;
const KEY_FILE_PATTERN = /\.(?:key|pem)$/iu;
const FILE_REFERENCE_ERROR =
    'Certificate file references must use normalized absolute POSIX paths and certificate extensions.';

const isSafeFileReference = (value: unknown, pattern: RegExp): value is string =>
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_CERTIFICATE_PATH_LENGTH &&
    !value.includes('\u0000') &&
    !value.includes('\r') &&
    !value.includes('\n') &&
    !value.includes('\\') &&
    posix.isAbsolute(value) &&
    posix.normalize(value) === value &&
    pattern.test(value);

export function assertSafeCertificateFileReferences(certificates: readonly unknown[]): void {
    for (const certificate of certificates) {
        if (!certificate || typeof certificate !== 'object') continue;

        const candidate = certificate as Record<string, unknown>;
        if (
            (candidate.certificateFile !== undefined &&
                !isSafeFileReference(candidate.certificateFile, CERTIFICATE_FILE_PATTERN)) ||
            (candidate.keyFile !== undefined &&
                !isSafeFileReference(candidate.keyFile, KEY_FILE_PATTERN))
        ) {
            throw new Error(FILE_REFERENCE_ERROR);
        }
    }
}
