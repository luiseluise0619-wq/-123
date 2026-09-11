import {customerSettings,openCustomerPool,CustomerStore} from '../server/customer-data.js';
if(!customerSettings().enabled)throw new Error('Customer data settings required');
const db=await openCustomerPool();
try{await new CustomerStore(db).purge();console.log('Expired customer data removed.');}finally{await db.end();}
