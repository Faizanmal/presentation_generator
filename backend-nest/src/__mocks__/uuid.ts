import * as crypto from 'crypto';

export const v4 = () => crypto.randomUUID();
export const v1 = () => '00000000-0000-0000-0000-000000000000';
export const v3 = () => '00000000-0000-0000-0000-000000000000';
export const v5 = () => '00000000-0000-0000-0000-000000000000';
export const NIL = '00000000-0000-0000-0000-000000000000';
export const validate = () => true;
export const version = () => 4;
