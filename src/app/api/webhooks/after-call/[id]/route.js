import { makeDeleteHandler } from '@/lib/delete-route';

export var dynamic = 'force-dynamic';

export var DELETE = makeDeleteHandler('after-call');
