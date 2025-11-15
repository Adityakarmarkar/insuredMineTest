var express = require('express');
var router = express.Router();
const {upload, handleUploadError} = require('../middleware/fileupload');
const { Worker } = require('worker_threads');
const path = require('path');
const { User, PolicyInfo } = require('../schemas');

router.post('/upload', upload.single('file'), handleUploadError, function(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;

  const worker = new Worker(path.join(__dirname, '../workers/csvProcessor.js'), {
    workerData: { filePath }
  });

  worker.on('message', (result) => {
    res.json({ 
      message: 'CSV processed successfully',
      data: result
    });
  });

  worker.on('error', (error) => {
    res.status(500).json({ 
      error: 'Error processing CSV',
      details: error.message 
    });
  });

  worker.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Worker stopped with exit code ${code}`);
    }
  });
});

router.get('/policy', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ 
        error: 'Username parameter is required' 
      });
    }

    const user = await User.findOne({ 
      firstName: { $regex: new RegExp(username, 'i') }
    });

    console.log('Found user:', user);

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        message: `No user found with username: ${username}`
      });
    }

    const policies = await PolicyInfo.find({ user: user._id })
      .populate('policyCategory', 'category_name')
      .populate('company', 'company_name')
      .populate('user', 'firstName email phone')
      .populate('account', 'name')
      .populate('agent', 'name')
      .sort({ startDate: -1 }); // Sort by most recent first

    if (policies.length === 0) {
      return res.status(404).json({
        message: 'No policies found for this user',
        user: {
          id: user._id,
          name: user.firstName,
          email: user.email
        }
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        dob: user.dob
      },
      totalPolicies: policies.length,
      policies: policies.map(policy => ({
        policyNumber: policy.policyNumber,
        startDate: policy.startDate,
        endDate: policy.endDate,
        category: policy.policyCategory?.category_name,
        company: policy.company?.company_name,
        account: policy.account?.name,
        agent: policy.agent?.name
      }))
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

router.get('/aggregated-policies', async (req, res) => {
  try {
    const aggregatedData = await PolicyInfo.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      },
      {
        $lookup: {
          from: 'policycategories',
          localField: 'policyCategory',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      },
      {
        $lookup: {
          from: 'policycarriers',
          localField: 'company',
          foreignField: '_id',
          as: 'companyInfo'
        }
      },
      {
        $unwind: '$companyInfo'
      },
      {
        $group: {
          _id: '$user',
          user: { $first: '$userInfo' },
          totalPolicies: { $sum: 1 },
          policies: {
            $push: {
              policyNumber: '$policyNumber',
              startDate: '$startDate',
              endDate: '$endDate',
              category: '$categoryInfo.category_name',
              company: '$companyInfo.company_name'
            }
          },
          categoriesCount: {
            $addToSet: '$categoryInfo.category_name'
          },
          companiesCount: {
            $addToSet: '$companyInfo.company_name'
          }
        }
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          user: {
            firstName: '$user.firstName',
            email: '$user.email',
            phone: '$user.phone',
            state: '$user.state',
            zipCode: '$user.zipCode'
          },
          totalPolicies: 1,
          uniqueCategories: { $size: '$categoriesCount' },
          uniqueCompanies: { $size: '$companiesCount' },
          policies: 1
        }
      },
      {
        $sort: { totalPolicies: -1 }
      }
    ]);

    if (aggregatedData.length === 0) {
      return res.status(404).json({
        message: 'No policies found in the system'
      });
    }

    res.json({
      success: true,
      totalUsers: aggregatedData.length,
      data: aggregatedData
    });

  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});


module.exports = router;