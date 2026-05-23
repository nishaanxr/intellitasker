const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  await db.collection('users').updateOne(
    { email: 'nishaang.btech23@rvu.edu.in' },
    { $set: { twoFactorEnabled: false } }
  );
  console.log('Disabled 2FA');
  process.exit(0);
});
