// The account that owns every workspace and sees the combined Operator View.
//
// A leaf module on purpose: access.js and workspace-auth.js both need it, and
// importing it from either of them would put a cycle between the two.
export var OWNER_EMAIL = 'shorty21taylor@gmail.com';
