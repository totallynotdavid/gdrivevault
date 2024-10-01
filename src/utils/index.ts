/**
 * Escapes single quotes in a string to prevent SQL injection.
 * Note: Since we're using parameterized queries, this is precautionary.
 * @param input The input string.
 * @returns The escaped string.
 */
export function escapeSingleQuotes(input: string): string {
    return input.replace(/'/g, "''");
}
