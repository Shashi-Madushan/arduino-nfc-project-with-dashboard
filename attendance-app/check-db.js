const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://localhost:27017/attendance');
  const db = mongoose.connection.db;
  const orders = await db.collection('orders').find({}).toArray();
  console.log('Total orders:', orders.length);
  if (orders.length > 0) {
    console.log('Sample order dates:', orders.map(o => o.date));
  }

  const employees = await db.collection('employees').find({}).toArray();
  console.log('Total employees:', employees.length);

  await mongoose.disconnect();
}
run();
