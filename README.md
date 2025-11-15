# InsuredMine Test Project

## ✨ Features

### Task 1: Policy Management System
- CSV/XLSX file upload with worker thread processing
- Search policies by username ( Here we have used first name as we don't have user name in our csv dump )
- Aggregated policy data per user
- Separate MongoDB collections for each entity ( Here not exactly I have avoided dublicate entries ) 

### Task 2: Server Management
- Real-time CPU monitoring with auto-restart at 70% threshold
- Scheduled message insertion into database


## ⚙️ Configuration

Update `.env` file with your configuration:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/insuredmine
CPU_THRESHOLD=0.7
CPU_CHECK_INTERVAL=5000
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/insuredmine |
| `CPU_THRESHOLD` | CPU usage threshold for restart (0-1) | 0.7 (70%) |
| `CPU_CHECK_INTERVAL` | CPU check interval in ms | 5000 |

## 🚀 Running the Application ( With PM2  )

```bash
npm install -g pm2
pm2 start app.js --name insuredmine
pm2 monit
```

## 📚 API Documentation

Base URL: `http://localhost:3000`

### Task 1: Policy Management

#### 1. Upload CSV/XLSX File

Upload and process insurance policy data using worker threads.

**Endpoint:** `POST /taskone/upload`

**Content-Type:** `multipart/form-data`

**Body:**
- `file`: CSV file (max 5MB)

**Example:**
```bash
curl -X POST http://localhost:3000/taskone/upload \
  -F "file=@data.csv"
```

**Response:**
```json
{
  "message": "CSV processed successfully",
  "data": {
    "success": true,
    "rowCount": 150,
    "message": "Data inserted successfully"
  }
}
```

**Features:**
- Processes CSV in a separate worker thread (non-blocking)
- Optimized bulk inserts for better performance
- Automatic duplicate detection
- Validates CSV format and file size

---

#### 2. Search Policy by Username

Find all policies associated with a specific user.

**Endpoint:** `GET /taskone/policy`

**Query Parameters:**
- `username` (required): User's first name

**Example:**
```bash
curl "http://localhost:3000/taskone/policy?username=Lura"
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "673abc123def456",
    "firstName": "Lura Lucca",
    "email": "madler@yahoo.ca",
    "phone": "8677356559",
    "address": {
      "street": "170 MATTHIAS CT",
      "city": "MOCKSVILLE",
      "state": "NC",
      "zip": "27028"
    },
    "dob": "1960-02-11"
  },
  "totalPolicies": 3,
  "policies": [
    {
      "policyNumber": "YEEX9MOIBU7X",
      "startDate": "2018-11-02",
      "endDate": "2019-11-02",
      "category": "Commercial Auto",
      "company": "Integon Gen Ins Corp",
      "account": "Lura Lucca & Owen Dodson",
      "agent": "Alex Watson"
    }
  ]
}
```

---

#### 3. Get Aggregated Policies by User

Retrieve aggregated policy data for all users.

**Endpoint:** `GET /taskone/aggregated-policies`

**Example:**
```bash
curl http://localhost:3000/taskone/aggregated-policies
```

**Response:**
```json
{
  "success": true,
  "totalUsers": 5,
  "data": [
    {
      "userId": "673abc123def456",
      "user": {
        "firstName": "Lura Lucca",
        "email": "madler@yahoo.ca",
        "phone": "8677356559",
        "state": "NC",
        "zipCode": "27028"
      },
      "totalPolicies": 3,
      "uniqueCategories": 2,
      "uniqueCompanies": 2,
      "policies": [...]
    }
  ]
}
```

**Aggregation Includes:**
- Total policies per user
- Number of unique policy categories
- Number of unique insurance companies
- Complete policy details

---

### Task 2: Server Monitoring & Scheduling

#### 1. Get CPU Statistics

Monitor current CPU usage and system information.

**Endpoint:** `GET /tasktwo/cpu-stats`

**Example:**
```bash
curl http://localhost:3000/tasktwo/cpu-stats
```

**Response:**
```json
{
  "success": true,
  "monitoring": true,
  "threshold": "70%",
  "checkInterval": "5000ms",
  "consecutiveHighUsage": 0,
  "cpuCount": 8,
  "freeMem": "4096 MB",
  "totalMem": "16384 MB",
  "freeMemPercentage": "25.00%",
  "loadAverage": [2.1, 1.8, 1.5]
}
```

---

#### 2. Get Current CPU Usage

Get instant CPU usage snapshot.

**Endpoint:** `GET /tasktwo/current-usage`

**Example:**
```bash
curl http://localhost:3000/tasktwo/current-usage
```

**Response:**
```json
{
  "cpuUsage": "45.32%",
  "cpuCount": 8,
  "freeMem": "4096 MB",
  "totalMem": "16384 MB",
  "platform": "darwin",
  "timestamp": "2024-11-16T10:30:00.000Z"
}
```

---

#### 3. CPU Stress Test

Simulate high CPU usage for testing auto-restart functionality.

**Endpoint:** `POST /tasktwo/stress-cpu`

**Body:**
```json
{
  "duration": 30000
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/tasktwo/stress-cpu \
  -H "Content-Type: application/json" \
  -d '{"duration": 30000}'
```

**Response:**
```json
{
  "message": "CPU stress test started",
  "duration": "30000ms",
  "warning": "This will increase CPU usage significantly"
}
```


## 🏗️ Architecture

### Project Structure
```
insuredMineTest/
├── app.js                 # Main application entry point
├── routes/
│   ├── index.js          # Task 1: Policy management routes
│   ├── cpuMonitor.js     # Task 2: CPU monitoring routes
│   └── message.js        # Task 2: Message scheduling routes
├── workers/
│   └── csvProcessor.js   # Worker thread for CSV processing
├── middleware/
│   └── fileupload.js     # Multer file upload configuration
├── schemas/
│   └── index.js          # MongoDB schemas and models
├── utils/
│   └── cpuMonitor.js     # CPU monitoring utility class
├── uploads/              # Temporary upload directory
├── .env                  # Environment configuration
├── .gitignore
├── package.json
└── README.md
```

### Key Technologies

- **Node.js & Express**: Server framework
- **MongoDB & Mongoose**: Database and ODM
- **Worker Threads**: Background CSV processing
- **Multer**: File upload handling
- **node-schedule**: Job scheduling
- **os-utils**: System monitoring
- **csv-parser**: CSV parsing

### Worker Thread Processing

CSV files are processed in a separate worker thread to prevent blocking the main event loop:

1. File uploaded via Multer
2. Worker thread spawned with file path
3. CSV parsed and validated
4. Optimized bulk database operations
5. Results sent back to main thread
6. Temporary file cleaned up

### CPU Monitoring

The CPU monitor runs independently and:

1. Checks CPU usage every 5 seconds (configurable)
2. Tracks consecutive high usage occurrences
3. Triggers server restart after 3 consecutive readings above threshold
4. Supports graceful shutdown with cleanup

### Message Scheduling

Uses node-schedule for precise job scheduling:

1. Message stored in database with "pending" status
2. Job scheduled for specified date/time
3. Job executes at scheduled time
4. Message status updated to "inserted"
5. Timestamp recorded in database



### Dry Run Testing

For testing purposes, the threshold was set at 10%, and the stress-cpu API was used to increase the server load.

![Screenshot](https://github.com/Adityakarmarkar/insuredMineTest/blob/1aa114ca3d2d58cb0991f3ada491b1322f82dc08/images/Screenshot%202025-11-16%20at%2012.41.26%E2%80%AFAM.png)
