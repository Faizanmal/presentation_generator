const {Pool} = require('pg');
(async function(){
  try {
    const pool = new Pool({connectionString:''});
    console.log('pool created');
    const res = await pool.query('SELECT 1');
    console.log(res);
    await pool.end();
  } catch (e) {
    console.error('caught', e);
  }
})();
