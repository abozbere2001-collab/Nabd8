
export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete';
    requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
    public readonly context: SecurityRuleContext;

    constructor(context: SecurityRuleContext) {
        const deniedMessage = `The following request was denied by Firestore Security Rules:
{
  "path": "${context.path}",
  "operation": "${context.operation}",
  "requestResourceData": ${JSON.stringify(context.requestResourceData, null, 2)}
}`;
        
        super(`FirestoreError: Missing or insufficient permissions: ${deniedMessage}`);
        this.name = 'FirestorePermissionError';
        this.context = context;
        
        // This is to make the error visible in the Next.js development overlay
        this.digest = `FIRESTORE_PERMISSION_ERROR: ${JSON.stringify(context)}`;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FirestorePermissionError);
        }
    }
}
