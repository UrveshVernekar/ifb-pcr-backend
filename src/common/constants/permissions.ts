export enum Permissions {
  // Production
  CREATE_PRODUCTION = 'production:create',
  READ_PRODUCTION = 'production:read',
  UPDATE_PRODUCTION = 'production:update',
  DELETE_PRODUCTION = 'production:delete',

  // Employees
  CREATE_EMPLOYEE = 'employee:create',
  READ_EMPLOYEE = 'employee:read',
  UPDATE_EMPLOYEE = 'employee:update',
  DELETE_EMPLOYEE = 'employee:delete',

  // Planning
  CREATE_PLANNING = 'planning:create',
  READ_PLANNING = 'planning:read',
  UPDATE_PLANNING = 'planning:update',
  DELETE_PLANNING = 'planning:delete',

  // Quality
  CREATE_QUALITY = 'quality:create',
  READ_QUALITY = 'quality:read',
  UPDATE_QUALITY = 'quality:update',
  DELETE_QUALITY = 'quality:delete',

  // Safety
  CREATE_SAFETY = 'safety:create',
  READ_SAFETY = 'safety:read',
  UPDATE_SAFETY = 'safety:update',
  DELETE_SAFETY = 'safety:delete',
}

export default Permissions;
