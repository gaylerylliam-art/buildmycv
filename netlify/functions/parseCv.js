// Compatibility endpoint: all new imports must use the authenticated, bounded, reviewed flow.
export const handler = async () => ({ statusCode: 410, headers: {'Content-Type':'application/json','Cache-Control':'no-store'}, body: JSON.stringify({ok:false,message:'Please refresh the CV builder to use the secure Upload Existing CV review flow.'}) });
