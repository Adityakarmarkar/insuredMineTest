const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const csv = require('csv-parser');

const mongoose = require('mongoose');
const {Agent, User, UserAccount, PolicyCategory, PolicyCarrier, PolicyInfo} = require('../schemas');

// Connect to MongoDB in worker thread
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const processCSV = async (filePath) => {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        insertToDatabaseOptimized(results)
          .then(() => {
            fs.unlink(filePath, (err) => {
              if (err) console.error('Error deleting file:', err);
            });
            resolve(results);
          })
          .catch((dbError) => {
            reject(dbError);
          });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};




const insertToDatabase = async (data) => {
  try {
    for (const row of data) {
      // 1. Create or find Agent
      let agent = await Agent.findOne({ name: row.agent });
      if (!agent) {
        agent = await Agent.create({ name: row.agent });
      }

      // 2. Create or find Policy Category
      let policyCategory = await PolicyCategory.findOne({ 
        category_name: row.category_name 
      });
      if (!policyCategory) {
        policyCategory = await PolicyCategory.create({ 
          category_name: row.category_name 
        });
      }

      // 3. Create or find Policy Carrier
      let policyCarrier = await PolicyCarrier.findOne({ 
        company_name: row.company_name 
      });
      if (!policyCarrier) {
        policyCarrier = await PolicyCarrier.create({ 
          company_name: row.company_name 
        });
      }

      // 4. Create or find User
      let user = await User.findOne({ email: row.email });
      if (!user) {
        user = await User.create({
          firstName: row.firstname,
          dob: row.dob ? new Date(row.dob) : undefined,
          address: {
            street: row.address,
            city: row.city,
            state: row.state,
            zip: row.zip
          },
          phone: row.phone,
          state: row.state,
          zipCode: row.zip,
          email: row.email,
          gender: row.gender ? row.gender.toLowerCase() : 'other',
          userType: row.userType ? row.userType.toLowerCase().replace(' ', '_') : 'individual'
        });
      }

      // 5. Create User Account
      let userAccount = await UserAccount.findOne({ 
        name: row.account_name,
        user: user._id
      });
      if (!userAccount) {
        userAccount = await UserAccount.create({
          name: row.account_name,
          user: user._id
        });
      }

      // 6. Create Policy Info
      const existingPolicy = await PolicyInfo.findOne({ 
        policyNumber: row.policy_number 
      });
      
      if (!existingPolicy) {
        await PolicyInfo.create({
          policyNumber: row.policy_number,
          startDate: new Date(row.policy_start_date),
          endDate: new Date(row.policy_end_date),
          policyCategory: policyCategory._id,
          company: policyCarrier._id,
          user: user._id,
          account: userAccount._id,
          agent: agent._id
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Database insertion error:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
};


const insertToDatabaseOptimized = async (data) => {
  try {

    const uniqueAgents = [...new Set(data.map(row => row.agent).filter(Boolean))];
    const uniqueCategories = [...new Set(data.map(row => row.category_name).filter(Boolean))];
    const uniqueCarriers = [...new Set(data.map(row => row.company_name).filter(Boolean))];
    const uniqueEmails = [...new Set(data.map(row => row.email).filter(Boolean))];

    // Batch fetch all existing records
    const [existingAgents, existingCategories, existingCarriers, existingUsers] = await Promise.all([
      Agent.find({ name: { $in: uniqueAgents } }).lean(),
      PolicyCategory.find({ category_name: { $in: uniqueCategories } }).lean(),
      PolicyCarrier.find({ company_name: { $in: uniqueCarriers } }).lean(),
      User.find({ email: { $in: uniqueEmails } }).lean()
    ]);

    // Create lookup maps for O(1) access
    const agentMap = new Map(existingAgents.map(a => [a.name, a]));
    const categoryMap = new Map(existingCategories.map(c => [c.category_name, c]));
    const carrierMap = new Map(existingCarriers.map(c => [c.company_name, c]));
    const userMap = new Map(existingUsers.map(u => [u.email, u]));

    // Prepare bulk insert arrays for new records
    const newAgents = [];
    const newCategories = [];
    const newCarriers = [];
    const newUsers = [];

    // Identify missing records
    uniqueAgents.forEach(name => {
      if (!agentMap.has(name)) {
        newAgents.push({ name });
      }
    });

    uniqueCategories.forEach(category => {
      if (!categoryMap.has(category)) {
        newCategories.push({ category_name: category });
      }
    });

    uniqueCarriers.forEach(company => {
      if (!carrierMap.has(company)) {
        newCarriers.push({ company_name: company });
      }
    });

    uniqueEmails.forEach(email => {
      const row = data.find(r => r.email === email);
      if (row && !userMap.has(email)) {
        newUsers.push({
          firstName: row.firstname,
          dob: row.dob ? new Date(row.dob) : undefined,
          address: {
            street: row.address,
            city: row.city,
            state: row.state,
            zip: row.zip
          },
          phone: row.phone,
          state: row.state,
          zipCode: row.zip,
          email: row.email,
          gender: row.gender ? row.gender.toLowerCase() : 'other',
          userType: row.userType ? row.userType.toLowerCase().replace(' ', '_') : 'individual'
        });
      }
    });

    // Bulk insert new records
    const [createdAgents, createdCategories, createdCarriers, createdUsers] = await Promise.all([
      newAgents.length > 0 ? Agent.insertMany(newAgents, { ordered: false }) : [],
      newCategories.length > 0 ? PolicyCategory.insertMany(newCategories, { ordered: false }) : [],
      newCarriers.length > 0 ? PolicyCarrier.insertMany(newCarriers, { ordered: false }) : [],
      newUsers.length > 0 ? User.insertMany(newUsers, { ordered: false }) : []
    ]);

    // Update maps with newly created records
    createdAgents.forEach(a => agentMap.set(a.name, a));
    createdCategories.forEach(c => categoryMap.set(c.category_name, c));
    createdCarriers.forEach(c => carrierMap.set(c.company_name, c));
    createdUsers.forEach(u => userMap.set(u.email, u));

    // Process User Accounts and Policies
    const accountsToInsert = [];
    const policiesToInsert = [];
    const accountLookup = new Map();

    // Fetch existing accounts
    const userIds = [...userMap.values()].map(u => u._id);
    const existingAccounts = await UserAccount.find({ user: { $in: userIds } }).lean();
    existingAccounts.forEach(acc => {
      const key = `${acc.name}_${acc.user}`;
      accountLookup.set(key, acc);
    });

    // Fetch existing policy numbers
    const policyNumbers = data.map(row => row.policy_number).filter(Boolean);
    const existingPolicies = await PolicyInfo.find({ 
      policyNumber: { $in: policyNumbers } 
    }).lean();
    const existingPolicyNumbers = new Set(existingPolicies.map(p => p.policyNumber));

    // Prepare bulk inserts
    for (const row of data) {
      const user = userMap.get(row.email);
      if (!user) continue;

      const accountKey = `${row.account_name}_${user._id}`;
      
      // Create account if not exists
      if (!accountLookup.has(accountKey)) {
        const newAccount = {
          name: row.account_name,
          user: user._id
        };
        accountsToInsert.push(newAccount);
        accountLookup.set(accountKey, newAccount);
      }

      // Create policy if not exists
      if (!existingPolicyNumbers.has(row.policy_number)) {
        const policyCategory = categoryMap.get(row.category_name);
        const policyCarrier = carrierMap.get(row.company_name);
        const agent = agentMap.get(row.agent);

        if (policyCategory && policyCarrier && agent) {
          policiesToInsert.push({
            policyNumber: row.policy_number,
            startDate: new Date(row.policy_start_date),
            endDate: new Date(row.policy_end_date),
            policyCategory: policyCategory._id,
            company: policyCarrier._id,
            user: user._id,
            account: accountLookup.get(accountKey)._id,
            agent: agent._id
          });
        }
      }
    }

    // Bulk insert accounts and policies
    let createdAccounts = [];
    if (accountsToInsert.length > 0) {
      createdAccounts = await UserAccount.insertMany(accountsToInsert, { 
        ordered: false 
      }).catch(err => {
        console.warn('Some accounts already exist:', err.writeErrors?.length || 0);
        return err.insertedDocs || [];
      });
      
      // Update accountLookup with _id from created accounts
      createdAccounts.forEach((acc, index) => {
        const key = `${acc.name}_${acc.user}`;
        accountLookup.set(key, acc);
      });
    }

    // Update policy account references
    for (const policy of policiesToInsert) {
      const row = data.find(r => r.policy_number === policy.policyNumber);
      const user = userMap.get(row.email);
      const accountKey = `${row.account_name}_${user._id}`;
      const account = accountLookup.get(accountKey);
      if (account && account._id) {
        policy.account = account._id;
      }
    }

    if (policiesToInsert.length > 0) {
      await PolicyInfo.insertMany(policiesToInsert, { 
        ordered: false 
      }).catch(err => {
        console.warn('Some policies already exist:', err.writeErrors?.length || 0);
      });
    }

    console.log(`✅ Processing complete:
      - Agents: ${newAgents.length} new, ${existingAgents.length} existing
      - Categories: ${newCategories.length} new, ${existingCategories.length} existing
      - Carriers: ${newCarriers.length} new, ${existingCarriers.length} existing
      - Users: ${newUsers.length} new, ${existingUsers.length} existing
      - Accounts: ${accountsToInsert.length} new
      - Policies: ${policiesToInsert.length} new`);

    return true;
  } catch (error) {
    console.error('Database insertion error:', error);
    throw error;
  } finally {
    // Close mongoose connection in worker thread
    await mongoose.connection.close();
  }
};

// Process the CSV file
processCSV(workerData.filePath)
  .then((data) => {
    parentPort.postMessage({
      success: true,
      rowCount: data.length,
      data: data
    });
  })
  .catch((error) => {
    parentPort.postMessage({
      success: false,
      error: error.message
    });
  });