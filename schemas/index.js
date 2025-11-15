const mongoose = require('mongoose');

const { Schema } = mongoose;

mongoose.Promise = global.Promise;

// Agent
const AgentSchema = new Schema(
    {
        name: { type: String, trim: true }
    },
    { timestamps: true }
);

// User
const AddressSchema = new Schema(
    {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zip: { type: String, trim: true }
    },
    { _id: false }
);

const UserSchema = new Schema(
    {
        firstName: { type: String, required: true, trim: true },
        dob: { type: Date },
        address: AddressSchema,
        phone: {
            type: String,
            trim: true,
            // match: [/^\+?[0-9\-() ]{7,20}$/, 'Invalid phone number']
        },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            match: [/\S+@\S+\.\S+/, 'Invalid email address'],
            index: true
        },
        gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
        userType: {
            type: String,
            default: 'unknown'
        }
    },
    { timestamps: true }
);

// Account (User's Account)
const UserAccountSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
);

// Policy Category (LOB)
const PolicyCategorySchema = new Schema(
    {
        category_name: { type: String, trim: true, unique: true }
    },
    { timestamps: true }
);

// Policy Carrier
const PolicyCarrierSchema = new Schema(
    {
        company_name: { type: String, trim: true, unique: true }
    },
    { timestamps: true }
);

// Message Schema
const MessageSchema = new Schema(
    {
        content: { type: String, required: true, trim: true },
        scheduledFor: { type: Date, required: true },
        insertedAt: { type: Date },
        status: { 
            type: String, 
            enum: ['pending', 'inserted', 'failed'],
            default: 'pending'
        },
        error: { type: String }
    },
    { timestamps: true }
);

// Policy Info
const PolicyInfoSchema = new Schema(
    {
        policyNumber: { type: String, required: true, trim: true, unique: true },
        startDate: { type: Date, required: true },
        endDate: { type: Date },
        policyCategory: { type: Schema.Types.ObjectId, ref: 'PolicyCategory', required: true },
        company: { type: Schema.Types.ObjectId, ref: 'PolicyCarrier', required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        account: { type: Schema.Types.ObjectId, ref: 'UserAccount' },
        agent: { type: Schema.Types.ObjectId, ref: 'Agent' }
    },
    { timestamps: true }
);

// Models
const Agent = mongoose.model('Agent', AgentSchema);
const User = mongoose.model('User', UserSchema);
const UserAccount = mongoose.model('UserAccount', UserAccountSchema);
const PolicyCategory = mongoose.model('PolicyCategory', PolicyCategorySchema);
const PolicyCarrier = mongoose.model('PolicyCarrier', PolicyCarrierSchema);
const PolicyInfo = mongoose.model('PolicyInfo', PolicyInfoSchema);
const Message = mongoose.model('Message', MessageSchema);


module.exports = {
    Agent,
    User,
    UserAccount,
    PolicyCategory,
    PolicyCarrier,
    PolicyInfo,
    Message
};