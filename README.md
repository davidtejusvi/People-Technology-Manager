# People-Technology-Manager
# People Technology Manager — AWS EKS Deployment

A full-stack **People Technology Manager** application deployed on **Amazon EKS** using Kubernetes.

The application consists of:

- React frontend
- Node.js backend
- MySQL database
- Kubernetes Deployments
- Kubernetes Services
- Kubernetes Secret
- Kubernetes ConfigMap
- PersistentVolumeClaim
- AWS EBS storage
- AWS EBS CSI Driver
- Amazon EKS managed node group
- Nginx reverse proxy

---

## 1. Application Architecture

```text
                         Internet
                            |
                            |
                 EC2 Public IP :31992
                            |
                            v
                +-----------------------+
                |   people-frontend    |
                |       Nginx          |
                |      NodePort        |
                |        :80           |
                +----------+------------+
                           |
                           | /api/*
                           v
                +-----------------------+
                |   people-backend     |
                |      ClusterIP       |
                |       :5001          |
                +----------+------------+
                           |
                           | MySQL
                           v
                +-----------------------+
                |        MySQL          |
                |      ClusterIP       |
                |       :3306          |
                +----------+------------+
                           |
                           v
                    +-------------+
                    |  mysql-pvc  |
                    |     5Gi     |
                    +------+------+
                           |
                           v
                       AWS EBS
2. AWS Infrastructure
The application was deployed to:
AWS Region: ap-south-1
EKS Cluster: ekswithdavid

Managed node group:
Node Group: mycustomng
Instance Type: c7i-flex.large
Desired: 2
Minimum: 2
Maximum: 2

The cluster eventually had two healthy nodes:
ip-192-168-2-188.ap-south-1.compute.internal
ip-192-168-47-32.ap-south-1.compute.internal

Both nodes reached:
STATUS: Ready

3. Create/Configure EKS Access
The cluster was discovered using:
aws eks list-clusters --region ap-south-1

The cluster returned:
ekswithdavid

Kubeconfig was configured using:
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name ekswithdavid

The Kubernetes context was verified:
kubectl config current-context

Result:
arn:aws:eks:ap-south-1:919006484182:cluster/ekswithdavid

4. Initial Node Problem
Initially:
kubectl get nodes

returned:
No resources found

The node group was checked using:
eksctl get nodegroup \
  --cluster ekswithdavid \
  --region ap-south-1

Initially the node group was:
CREATING

After the node group finished provisioning:
ACTIVE

Then:
kubectl get nodes

returned two nodes:
NAME                                           STATUS
ip-192-168-2-188.ap-south-1.compute.internal   Ready
ip-192-168-47-32.ap-south-1.compute.internal   Ready

5. Kubernetes Namespace
A dedicated namespace was created:
apiVersion: v1
kind: Namespace
metadata:
  name: people-app

Applied with:
kubectl apply -f namespace.yaml

Verified with:
kubectl get namespaces

6. Kubernetes System Components
The following system components were running:
aws-node
coredns
kube-proxy
metrics-server

Verified with:
kubectl get pods -A

7. MySQL Configuration
MySQL was deployed inside the people-app namespace.
Database configuration:

Database: peopledb
Username: root
Port:     3306

The MySQL Kubernetes Service was:
mysql:3306

The backend uses:
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_NAME=peopledb

8. Kubernetes Secret
Database credentials were stored in a Kubernetes Secret.
apiVersion: v1
kind: Secret
metadata:
  name: mysql-secret
  namespace: people-app
stringData:
  DB_PASSWORD: rootpassword
  MYSQL_ROOT_PASSWORD: rootpassword
type: Opaque

The backend gets the database password from:
valueFrom:
  secretKeyRef:
    name: mysql-secret
    key: DB_PASSWORD

MySQL gets the root password from:
valueFrom:
  secretKeyRef:
    name: mysql-secret
    key: MYSQL_ROOT_PASSWORD

9. MySQL Initialization
The SQL initialization file was located at:
database/init.sql

A ConfigMap was created:
kubectl create configmap mysql-init \
  --from-file=init.sql=../database/init.sql \
  -n people-app

The ConfigMap was mounted into:
/docker-entrypoint-initdb.d/init.sql

This allowed MySQL to initialize the database automatically.
10. Persistent Storage
The MySQL PVC requested:
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
  namespace: people-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi

The EKS cluster had the gp2 StorageClass:
NAME   PROVISIONER             VOLUMEBINDINGMODE
gp2    kubernetes.io/aws-ebs   WaitForFirstConsumer

11. PVC Problem
Initially:
kubectl get pvc -n people-app

returned:
NAME        STATUS
mysql-pvc   Pending

The PVC events showed:
ExternalProvisioning

Waiting for a volume to be created by the external provisioner
'ebs.csi.aws.com'

We checked:
kubectl get pods -n kube-system | grep -i ebs

There were no EBS CSI Driver pods.
Root Cause
The AWS EBS CSI Driver was not installed.
Therefore Kubernetes could not dynamically provision the requested EBS volume.

12. EBS CSI IAM Problem
The first attempt to create the EBS CSI IAM service account failed.
CloudFormation reported:

Policy arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2
does not exist or is not attachable.

We checked the IAM role:
aws iam get-role \
  --role-name AmazonEKS_EBS_CSI_DriverRole \
  --query 'Role.Arn' \
  --output text

The role existed:
arn:aws:iam::919006484182:role/AmazonEKS_EBS_CSI_DriverRole

The attached policy was:
AmazonEBSCSIDriverPolicy

Verified with:
aws iam list-attached-role-policies \
  --role-name AmazonEKS_EBS_CSI_DriverRole

13. Install AWS EBS CSI Driver
The existing IAM role was supplied to the EKS add-on:
aws eks create-addon \
  --cluster-name ekswithdavid \
  --region ap-south-1 \
  --addon-name aws-ebs-csi-driver \
  --service-account-role-arn arn:aws:iam::919006484182:role/AmazonEKS_EBS_CSI_DriverRole

The add-on was successfully created.
Verified with:

kubectl get pods -n kube-system | grep ebs

Result:
ebs-csi-controller-...   6/6   Running
ebs-csi-controller-...   6/6   Running
ebs-csi-node-...         3/3   Running
ebs-csi-node-...         3/3   Running

The CSI driver was also verified:
kubectl get csidrivers

Result included:
ebs.csi.aws.com

14. PVC Became Bound
After installing the EBS CSI Driver:
kubectl get pvc -n people-app

returned:
NAME        STATUS   VOLUME                                     CAPACITY
mysql-pvc   Bound    pvc-53f62fed-eb0b-4e14-b210-40166fb94ac2   5Gi

This confirmed that AWS EBS dynamic provisioning was working.
15. MySQL Container Configuration Problem
The MySQL pod initially entered:
CreateContainerConfigError

We checked:
kubectl get secret mysql-secret -n people-app

and received:
secrets "mysql-secret" not found

The MySQL Deployment referenced:
mysql-secret

Therefore Kubernetes could not inject the required environment variables.
Solution
The missing Secret was created/applied.
After that:

kubectl get pods -n people-app

returned:
mysql-...   1/1   Running

16. Verify MySQL
MySQL was tested from inside the container:
kubectl exec -it -n people-app mysql-59f96556c9-pz282 -- \
  mysql -uroot -prootpassword \
  -e "USE peopledb; SHOW TABLES;"

Result:
+--------------------+
| Tables_in_peopledb |
+--------------------+
| people             |
+--------------------+

This confirmed:
MySQL was running
Database existed
Persistent storage worked
Initialization SQL executed
people table existed
17. Backend Deployment
Backend image:
davidtejusvi/people-backend:1.0

Backend port:
5001

Backend environment:
PORT=5001
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<Kubernetes Secret>
DB_NAME=peopledb

Backend Service:
Name: people-backend
Type: ClusterIP
Port: 5001

The backend Deployment used:
resources:
  requests:
    cpu: "250m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"

18. Backend Health Check
The backend provides:
GET /api/health

Testing:
curl http://localhost:5001/api/health

returned:
{
  "status": "UP",
  "message": "People API is running"
}

Backend logs showed:
Backend running on port 5001

19. Frontend Deployment
Frontend image:
davidtejusvi/people-frontend:1.0

The frontend runs using Nginx on:
Port 80

The Kubernetes Service was:
type: NodePort

The assigned NodePort was:
31992

Service output:
people-frontend   NodePort   80:31992/TCP

20. Frontend Dockerfile
The frontend used a multi-stage Docker build:
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

The React application was built using Vite and served by Nginx.
21. Frontend NodePort Problem
Initially:
curl http://65.2.10.166:31992/

failed.
We verified the frontend pods:

kubectl get pods \
  -n people-app \
  -l app=people-frontend \
  -o wide

All frontend pods were:
1/1 Running

We checked Service endpoints:
kubectl get endpoints people-frontend -n people-app

The endpoints existed:
192.168.46.69:80
192.168.5.33:80
192.168.56.112:80

This confirmed that the Service had healthy backend endpoints.
22. Verify NodePort
One node had the public IP:
13.201.4.137

Testing:
curl -v http://13.201.4.137:31992/

returned:
HTTP/1.1 200 OK
Server: nginx/1.31.4

Therefore:
Frontend pods were healthy
Kubernetes Service was working
NodePort was working
Nginx was serving the React application
AWS Security Group allowed port 31992
23. Frontend Could Not Load People
The browser displayed:
People Technology Manager

Add Person

Name
Email
AWS, Kubernetes, React
Experience

Unable to load people

Browser developer tools showed:
Request URL:
http://localhost:5001/api/people

Root Cause
The frontend was configured to call:
http://localhost:5001/api

The browser's localhost means the user's own computer.
It does not mean the Kubernetes backend.

24. Find the Incorrect Configuration
We searched the frontend:
grep -R "localhost:5001" frontend \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=dist

The result was:
frontend/.env:VITE_API_URL=http://localhost:5001/api

frontend/src/services/personApi.js:
import.meta.env.VITE_API_URL || "http://localhost:5001/api";

This confirmed that the React application had been built with a local backend URL.
25. Correct Solution — Nginx Reverse Proxy
Instead of exposing the backend directly to the browser, Nginx was configured to proxy /api/ requests to the Kubernetes backend Service.
Final Nginx configuration:

server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://people-backend:5001/api/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}

This changed the architecture to:
Browser
   |
   | /api/people
   v
Frontend NodePort
   |
   v
Nginx
   |
   | proxy
   v
people-backend:5001
   |
   v
MySQL:3306

26. Verify Nginx Configuration
The configuration was checked inside the frontend pod:
kubectl exec -n people-app \
  people-frontend-5d5c876d95-2lb5r \
  -- cat /etc/nginx/conf.d/default.conf

The /api/ proxy was present:
location /api/ {
    proxy_pass http://people-backend:5001/api/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

27. Test API Through Frontend
The API was tested from inside Kubernetes:
kubectl run curl-test \
  -n people-app \
  --rm -it \
  --image=curlimages/curl \
  --restart=Never \
  -- curl -s http://people-frontend/api/people

The API returned:
[
  {
    "id": 2,
    "name": "John",
    "email": "john@test.com",
    "technologies": "Java, AWS, Docker",
    "experience": 5,
    "created_at": "2026-08-22T20:06:35.000Z"
  },
  {
    "id": 1,
    "name": "David",
    "email": "david@test.com",
    "technologies": "AWS, Kubernetes, React",
    "experience": 8,
    "created_at": "2026-08-22T20:06:35.000Z"
  }
]

This confirmed:
Frontend
   ↓
Nginx
   ↓
Backend
   ↓
MySQL

was working correctly.
28. Final Application Flow
The final browser request was:
http://<NODE-PUBLIC-IP>:31992/

The frontend loaded from Nginx.
When React requested:

/api/people

the request went to:
Nginx

Nginx proxied it to:
people-backend:5001

The backend queried:
mysql:3306

MySQL queried the:
people

table stored on the AWS EBS volume.
The data was returned back through the same path:

MySQL
  ↓
Backend
  ↓
Nginx
  ↓
React
  ↓
Browser

29. Complete Kubernetes Resource Structure
people-app
│
├── Namespace
│
├── people-frontend
│   ├── Deployment
│   └── NodePort Service
│
├── people-backend
│   ├── Deployment
│   └── ClusterIP Service
│
├── mysql
│   ├── Deployment
│   └── ClusterIP Service
│
├── mysql-secret
│   └── Database credentials
│
├── mysql-init
│   └── init.sql
│
└── mysql-pvc
    └── 5Gi AWS EBS volume

30. Problems and Solutions
Problem	Root Cause	Solution
kubectl get nodes → No resources found	Node group still creating	Waited for node group to become ACTIVE
mysql-pvc → Pending	EBS CSI Driver unavailable	Installed AWS EBS CSI Driver
EBS CSI IAM creation failed	Invalid AmazonEBSCSIDriverPolicyV2 policy reference	Used existing EBS CSI IAM role with AmazonEBSCSIDriverPolicy
MySQL pod → Pending	PVC couldn't provision EBS	Installed EBS CSI Driver
MySQL pod → CreateContainerConfigError	mysql-secret missing	Created/applied Kubernetes Secret
MySQL database unavailable	Database had not initialized	Mounted init.sql ConfigMap
Frontend initially inaccessible through NodePort	Network/security group issue	Verified and allowed NodePort 31992
Frontend → Unable to load people	Frontend called localhost:5001	Added Nginx reverse proxy
/api/people returned 404	Nginx had no /api/ route	Added /api/ proxy configuration
Backend container had no curl	Minimal application image	Tested networking using a temporary curl pod

31. Important Kubernetes Debugging Commands
Nodes
kubectl get nodes

All application pods
kubectl get pods -n people-app

Services
kubectl get svc -n people-app

PVC
kubectl get pvc -n people-app

Pod details
kubectl describe pod -n people-app <pod-name>

PVC details
kubectl describe pvc -n people-app mysql-pvc

Backend logs
kubectl logs -n people-app deployment/people-backend

Frontend endpoints
kubectl get endpoints people-frontend -n people-app

CSI drivers
kubectl get csidrivers

EBS CSI pods
kubectl get pods -n kube-system | grep ebs

32. Useful AWS Commands
List EKS clusters
aws eks list-clusters --region ap-south-1

List node groups
aws eks list-nodegroups \
  --cluster-name ekswithdavid \
  --region ap-south-1

List EKS add-ons
aws eks list-addons \
  --cluster-name ekswithdavid \
  --region ap-south-1

Check EBS volumes
aws ec2 describe-volumes \
  --region ap-south-1

Check CloudFormation
aws cloudformation list-stacks \
  --region ap-south-1

33. AWS Cleanup
After testing the application, the EKS environment was completely removed.
The cluster was deleted using:

eksctl delete cluster \
  --name ekswithdavid \
  --region ap-south-1 \
  --wait

Verification:
aws eks list-clusters --region ap-south-1

Result:
{
    "clusters": []
}

The EBS CSI IAM role was also removed.
Verification:

aws iam get-role \
  --role-name AmazonEKS_EBS_CSI_DriverRole

Result:
NoSuchEntity

CloudFormation resources associated with the cluster were confirmed as:
DELETE_COMPLETE

The leftover 5GiB EBS volume created for MySQL was identified and cleaned up separately.
Older EBS volumes that were already in use were not deleted.

34. Final Verification
The final deployment successfully demonstrated:
                 AWS
                  |
                  v
              Amazon EKS
                  |
       +----------+----------+
       |                     |
       v                     v
   Frontend              Backend
    Nginx                 Node.js
       |                     |
       +----------+----------+
                  |
                  v
                MySQL
                  |
                  v
                AWS EBS

The application successfully returned people data from MySQL:
[
  {
    "id": 2,
    "name": "John",
    "email": "john@test.com",
    "technologies": "Java, AWS, Docker",
    "experience": 5
  },
  {
    "id": 1,
    "name": "David",
    "email": "david@test.com",
    "technologies": "AWS, Kubernetes, React",
    "experience": 8
  }
]

35. Key Lessons Learned
Kubernetes Service Discovery
Applications inside Kubernetes should communicate using Service DNS names:
people-backend:5001
mysql:3306

rather than using localhost.
Browser localhost
A browser request to:
http://localhost:5001

means:
The user's own computer

It does not mean:
Kubernetes backend

This was the main reason the frontend initially displayed:
Unable to load people

EBS CSI Driver
AWS EBS dynamic provisioning requires the EBS CSI Driver:
PVC
 |
 v
StorageClass
 |
 v
EBS CSI Driver
 |
 v
AWS EBS

Without the CSI driver, the PVC remained:
Pending

Kubernetes Secrets
Database credentials should be provided through Kubernetes Secrets rather than directly exposing them in the Deployment.
Debugging Kubernetes
The most useful commands during troubleshooting were:
kubectl get pods
kubectl describe pod
kubectl get pvc
kubectl describe pvc
kubectl get svc
kubectl get endpoints
kubectl logs

These commands made it possible to identify the problem layer-by-layer.
36. Final Result
The People Technology Manager application was successfully deployed and tested on Amazon EKS.
The final working stack consisted of:

React
  ↓
Nginx
  ↓
Kubernetes NodePort
  ↓
people-backend Service
  ↓
Node.js Backend
  ↓
MySQL Service
  ↓
MySQL
  ↓
Kubernetes PVC
  ↓
AWS EBS

The application successfully:
Served the React frontend
Exposed the frontend through NodePort
Routed /api/* through Nginx
Connected the backend to MySQL
Initialized the database
Persisted MySQL data using AWS EBS
Returned people data through the REST API
Displayed the data in the browser
After testing, the AWS EKS environment was cleaned up successfully.