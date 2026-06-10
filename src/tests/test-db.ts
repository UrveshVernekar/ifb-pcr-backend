import knex from 'knex';

const testDialectCompilation = () => {
  const clients = ['pg', 'mysql2', 'mssql'];
  
  console.log('--- Testing Query Builder Compilation across Dialects ---');
  
  for (const client of clients) {
    try {
      const k = knex({
        client,
        connection: {
          host: '127.0.0.1',
          user: 'test_user',
          password: 'test_password',
          database: 'test_db'
        }
      });
      
      // Compile a SELECT query
      const selectSql = k('users').where({ user_id: 5, is_active: true }).toString();
      console.log(`✅ [${client}] Select SQL:  ${selectSql}`);
      
      // Compile an INSERT query (testing dynamic insert return formats)
      const insertSql = k('users').insert({
        full_name: 'John Doe',
        email: 'john@example.com',
        role_id: 1
      }).toString();
      console.log(`✅ [${client}] Insert SQL:  ${insertSql}`);
      
      k.destroy();
    } catch (error: any) {
      console.error(`❌ [${client}] Failed compilation:`, error.message);
    }
  }
};

testDialectCompilation();
