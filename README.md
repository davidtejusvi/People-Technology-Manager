People Technology Manager — Clean Architecture Explanation

This project is a full-stack application deployed on Amazon EKS using Kubernetes.

The application has three main parts:

React → frontend
Node.js → backend/API
MySQL → database

Kubernetes manages all three, while AWS EBS provides persistent storage for MySQL.

1. Overall Architecture

The easiest way to understand the project is:

                         Internet
                            |
                            |
                    EC2 Node Public IP
                         :31992
                            |
                            v
                  +-------------------+
                  |   Frontend        |
                  | React + Nginx     |
                  | NodePort :80      |
                  +---------+---------+
                            |
                         /api/*
                            |
                            v
                  +-------------------+
                  |     Backend       |
                  | Node.js           |
                  | ClusterIP :5001   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |      MySQL        |
                  | ClusterIP :3306   |
                  +---------+---------+
                            |
                            v
                  +-------------------+
                  |    mysql-pvc      |
                  |       5Gi         |
                  +---------+---------+
                            |
                            v
                       AWS EBS

This architecture is described in the project documentation.

In simple words

A user opens:

http://<NODE-PUBLIC-IP>:31992

The request reaches the frontend NodePort.

Nginx serves the React application.

When React needs data, it calls:

/api/people

Nginx forwards that request to:

people-backend:5001

The Node.js backend talks to:

mysql:3306

MySQL stores its data on:

AWS EBS
2. AWS Infrastructure

The application was deployed on:

AWS
 └── ap-south-1
      └── EKS
           └── ekswithdavid
                └── Managed Node Group
                     ├── Node 1
                     └── Node 2

The EKS cluster was:

Cluster: ekswithdavid
Region:  ap-south-1

The managed node group was:

Name:     mycustomng
Instance: c7i-flex.large
Desired:  2
Minimum:  2
Maximum:  2

Both nodes eventually became:

Ready

according to the project deployment record.

3. How You Connected to EKS

First, you checked whether the cluster existed:

aws eks list-clusters --region ap-south-1

It returned:

ekswithdavid

Then you configured your local machine to communicate with the cluster:

aws eks update-kubeconfig \
  --region ap-south-1 \
  --name ekswithdavid

This updates your kubeconfig so that:

kubectl
   |
   v
Amazon EKS

can communicate with the cluster.

You verified the context using:

kubectl config current-context

The context pointed to the EKS cluster.

4. First Problem — Nodes Were Not Available

Initially:

kubectl get nodes

returned:

No resources found

Why?

Because the managed node group was still:

CREATING

You checked it with:

eksctl get nodegroup \
  --cluster ekswithdavid \
  --region ap-south-1

After provisioning completed, the node group became:

ACTIVE

Then:

kubectl get nodes

showed two nodes:

Node 1    Ready
Node 2    Ready
Important lesson

An EKS control plane can exist while worker nodes are still provisioning.

So:

EKS Cluster exists
        ≠
Worker nodes are ready

5. Kubernetes Namespace

Instead of deploying everything into default, you created:

people-app

namespace.

Conceptually:

EKS Cluster
   |
   +── kube-system
   |
   +── people-app
          |
          +── Frontend
          +── Backend
          +── MySQL
          +── Secret
          +── ConfigMap
          +── PVC

This gives your application its own logical Kubernetes environment.

The namespace was created with:

kubectl apply -f namespace.yaml

6. Kubernetes System Components

The EKS cluster had important Kubernetes components such as:

aws-node
coredns
kube-proxy
metrics-server

These were running in:

kube-system

You checked them using:

kubectl get pods -A

7. MySQL Database

Your application uses:

Database: peopledb
User:     root
Port:     3306

Inside Kubernetes, the backend does not connect to an IP address.

It uses the Kubernetes Service name:

mysql

So the backend configuration is:

DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_NAME=peopledb

Therefore:

Node.js Backend
       |
       | mysql:3306
       v
     MySQL

This is Kubernetes Service Discovery.

8. Kubernetes Secret

The database password should not be directly written into the Deployment.

Instead, you created:

mysql-secret

The Secret contains:

DB_PASSWORD
MYSQL_ROOT_PASSWORD

The backend obtains:

DB_PASSWORD

from the Secret.

MySQL obtains:

MYSQL_ROOT_PASSWORD

from the same Secret.

Why Secret?

Because sensitive information such as:

passwords
API keys
tokens
credentials

should be separated from normal application configuration.

9. ConfigMap — MySQL Initialization

You had an SQL file:

database/init.sql

It creates/initializes the database structure.

You converted it into a ConfigMap:

kubectl create configmap mysql-init \
  --from-file=init.sql=../database/init.sql \
  -n people-app

It was mounted into:

/docker-entrypoint-initdb.d/init.sql

MySQL automatically processes initialization SQL placed there when the database is initialized.

So:

init.sql
   |
   v
ConfigMap
   |
   v
MySQL Pod
   |
   v
/docker-entrypoint-initdb.d/init.sql
   |
   v
Database initialized
10. Persistent Storage — Very Important

This is one of the most important parts of the project.

You created:

mysql-pvc

with:

Storage: 5Gi
Access Mode: ReadWriteOnce

The PVC requests storage from Kubernetes.

The flow is:

MySQL
  |
  v
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
11. PVC Problem

Initially:

kubectl get pvc -n people-app

showed:

mysql-pvc   Pending

This means:

Kubernetes requested storage, but Kubernetes could not create/provide the volume.

You checked the events and found:

Waiting for a volume to be created by
external provisioner 'ebs.csi.aws.com'

Then you checked:

kubectl get pods -n kube-system | grep -i ebs

There were no EBS CSI Driver pods.

Root cause

The:

AWS EBS CSI Driver

was not installed.

Therefore:

PVC
 |
 X
EBS

could not be created.

12. EBS CSI Driver

The EBS CSI Driver allows Kubernetes to communicate with AWS EBS.

Without it:

Kubernetes
    |
    X
AWS EBS

With it:

Kubernetes
    |
    v
EBS CSI Driver
    |
    v
AWS EBS

You also encountered an IAM policy issue where:

AmazonEBSCSIDriverPolicyV2

was not available/attachable.

You discovered an existing IAM role using:

AmazonEBSCSIDriverPolicy

and used that role for the EBS CSI add-on.

13. Installing EBS CSI Driver

The EBS CSI add-on was created:

aws eks create-addon \
  --cluster-name ekswithdavid \
  --region ap-south-1 \
  --addon-name aws-ebs-csi-driver \
  --service-account-role-arn <role-arn>

After installation:

kubectl get pods -n kube-system | grep ebs

showed:

ebs-csi-controller    Running
ebs-csi-node           Running

You also verified:

kubectl get csidrivers

and saw:

ebs.csi.aws.com

14. PVC Became Bound

After installing the CSI driver:

kubectl get pvc -n people-app

showed:

mysql-pvc   Bound   5Gi

This means:

PVC
 |
 v
AWS EBS Volume

was successfully established.

This is called dynamic provisioning.

15. MySQL Pod Problem

After fixing storage, MySQL encountered another problem:

CreateContainerConfigError

You checked:

kubectl get secret mysql-secret -n people-app

and Kubernetes reported:

secrets "mysql-secret" not found

The MySQL Deployment expected:

mysql-secret

but the Secret didn't exist.

So Kubernetes couldn't provide the required environment variables.

Solution

You created/applied the Secret.

After that:

kubectl get pods -n people-app

showed:

mysql   1/1   Running

16. Verify MySQL

You then tested MySQL directly inside the container:

kubectl exec -it -n people-app <mysql-pod> -- \
  mysql -uroot -prootpassword \
  -e "USE peopledb; SHOW TABLES;"

It returned:

people

This proved several things:

MySQL running          ✓
Database exists        ✓
EBS storage working    ✓
init.sql executed      ✓
people table exists    ✓

17. Backend

Your backend is:

Node.js

Docker image:

davidtejusvi/people-backend:1.0

Port:

5001

Backend configuration:

PORT=5001
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<Secret>
DB_NAME=peopledb

The backend is exposed inside Kubernetes using:

ClusterIP

Service:

people-backend

Port:

5001

18. Why ClusterIP for Backend?

You don't want users directly accessing your backend.

You only need:

Frontend → Backend

So the backend can remain internal.

That's why:

people-backend
Type: ClusterIP

is appropriate.

The backend is accessible from inside the cluster using:

people-backend:5001
19. Backend Health Check

The backend exposes:

GET /api/health

which returns:

{
  "status": "UP",
  "message": "People API is running"
}

This is useful because it tells you:

Backend container
       ↓
Node.js application
       ↓
HTTP server

is working.

20. Frontend

The frontend is:

React + Vite

Docker image:

davidtejusvi/people-frontend:1.0

React is built and then served using:

Nginx

Nginx listens on:

80

The Kubernetes Service is:

NodePort

with:

31992

So users can access:

http://<NODE-PUBLIC-IP>:31992

21. Why Multi-Stage Docker Build?

The frontend Dockerfile uses:

FROM node:22-alpine AS build

The React application is built:

RUN npm run build

This creates:

dist/

Then the second image is:

FROM nginx:alpine

and the compiled React files are copied:

COPY --from=build /app/dist /usr/share/nginx/html

So the final container only needs Nginx and the built static files.

Architecture:

Node.js image
     |
     | npm build
     v
   dist/
     |
     v
Nginx image
     |
     v
Production container

22. NodePort Problem

Initially you tested:

http://65.2.10.166:31992/

and it failed.

You checked the frontend pods:

kubectl get pods -n people-app -l app=people-frontend -o wide

They were:

1/1 Running

Then you checked:

kubectl get endpoints people-frontend -n people-app

and found healthy endpoints.

So the application pods themselves were working.

You then tested the actual node public IP:

13.201.4.137

using:

curl -v http://13.201.4.137:31992/

and received:

HTTP/1.1 200 OK
Server: nginx

This confirmed the NodePort path was working.

23. The Most Important Problem — localhost

The frontend loaded, but the browser displayed:

Unable to load people

The browser was trying:

http://localhost:5001/api/people

This is a very common Kubernetes mistake.

What does browser localhost mean?

If your browser is running on your laptop:

localhost

means:

YOUR LAPTOP

It does not mean:

Kubernetes Pod

So:

React Browser
     |
     | localhost:5001
     v
Your laptop

not:

React
 |
 v
Kubernetes Backend

The project documentation identifies this as the main reason the frontend initially could not load people.

24. Finding the Problem

You searched the frontend source:

grep -R "localhost:5001" frontend

and found:

frontend/.env
VITE_API_URL=http://localhost:5001/api

and:

personApi.js

also contained:

http://localhost:5001/api

Therefore the React application was built with a local development URL.

25. Correct Solution — Nginx Reverse Proxy

Instead of exposing the backend directly to the browser, you configured Nginx.

The browser sends:

/api/people

to the frontend.

Nginx receives it and forwards it to:

people-backend:5001

The configuration was:

location /api/ {
    proxy_pass http://people-backend:5001/api/;

    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

26. Now the Traffic Flow Is Correct

The final architecture became:

                    Browser
                       |
                       | http://NODE-IP:31992
                       v
               Frontend NodePort
                       |
                       v
                     Nginx
                    /     \
                   /       \
             /api/*         /
                |             |
                v             v
        people-backend      React
           :5001
             |
             v
          mysql:3306
             |
             v
          MySQL
             |
             v
          AWS EBS

This is the key architecture you should remember.

27. How Nginx Solves the Problem

Before:

Browser
   |
   | localhost:5001
   X

After:

Browser
   |
   | /api/people
   v
Nginx
   |
   | people-backend:5001
   v
Backend

This works because:

people-backend

is a Kubernetes Service.

Kubernetes DNS resolves:

people-backend

to the backend Service.

28. Testing the Complete API

You tested the API from inside Kubernetes:

kubectl run curl-test \
  -n people-app \
  --rm -it \
  --image=curlimages/curl \
  --restart=Never \
  -- curl -s http://people-frontend/api/people

The API returned people data.

That proved:

Frontend
   ↓
Nginx
   ↓
Backend
   ↓
MySQL

was working.

29. Complete Request Flow

This is the most important flow to understand for an interview.

Suppose the user opens:

http://13.201.4.137:31992
Step 1 — Browser

Browser requests:

/
Step 2 — NodePort

Kubernetes NodePort:

31992

receives the request.

Step 3 — Frontend Service

The request reaches the frontend Pod.

Step 4 — Nginx

Nginx serves:

React application
Step 5 — React

React requests:

/api/people
Step 6 — Nginx

Nginx sees:

/api/*

and proxies it to:

people-backend:5001
Step 7 — Node.js

Node.js receives:

GET /api/people
Step 8 — MySQL

Node.js connects to:

mysql:3306
Step 9 — Database

MySQL queries:

people

table.

Step 10 — Storage

MySQL data is persisted on:

AWS EBS
Response

The response travels back:

MySQL
  ↓
Node.js
  ↓
Backend Service
  ↓
Nginx
  ↓
Frontend
  ↓
Browser

This complete flow is documented in the project.

30. Kubernetes Resources

Your application ultimately consisted of:

people-app
│
├── Namespace
│
├── Frontend
│   ├── Deployment
│   └── NodePort Service
│
├── Backend
│   ├── Deployment
│   └── ClusterIP Service
│
├── MySQL
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
    └── AWS EBS

31. Problems You Solved

This is actually one of the strongest parts of your project because you didn't just deploy it—you debugged multiple real Kubernetes problems.

Problem	Root Cause	Solution
Nodes unavailable	Node group still creating	Waited for node group
PVC Pending	EBS CSI Driver missing	Installed CSI Driver
EBS IAM problem	Invalid policy reference	Used existing IAM role
MySQL Pending	Storage unavailable	Fixed EBS CSI
MySQL ConfigError	Secret missing	Created Secret
Database initialization issue	init.sql not mounted	ConfigMap
NodePort access issue	Network/security configuration	Verified NodePort/SG
Frontend couldn't load people	React called localhost	Nginx reverse proxy
/api routing issue	No Nginx route	Added /api/ proxy
Backend lacked curl	Minimal image	Used temporary curl pod

32. Kubernetes Debugging Method

One of the biggest lessons from this project is:

Don't randomly change YAML. Find which layer is broken.

Use this sequence:

1. Pod
   ↓
2. Service
   ↓
3. Endpoints
   ↓
4. Network
   ↓
5. Storage
   ↓
6. Configuration
   ↓
7. Application logs

Useful commands:

kubectl get pods -n people-app
kubectl describe pod -n people-app <pod>
kubectl logs -n people-app deployment/people-backend
kubectl get svc -n people-app
kubectl get endpoints -n people-app
kubectl get pvc -n people-app
kubectl describe pvc -n people-app mysql-pvc

These were the primary debugging commands used in the project.

33. The 5 Most Important Concepts You Learned
1. Kubernetes Service Discovery

Inside Kubernetes:

people-backend:5001
mysql:3306

are used instead of hard-coded Pod IP addresses.

2. localhost Is Different

Inside a browser:

localhost

means:

user's own computer

It does not mean your Kubernetes backend.

3. EBS CSI Driver

For dynamic EBS provisioning:

PVC
 ↓
StorageClass
 ↓
EBS CSI Driver
 ↓
AWS EBS

Without the CSI driver:

PVC = Pending

4. Kubernetes Secrets

Passwords should be supplied through:

Secret

rather than directly exposing them in application configuration.

5. Layer-by-Layer Debugging

When something fails:

kubectl get
        ↓
kubectl describe
        ↓
kubectl logs
        ↓
check Service
        ↓
check Endpoints
        ↓
check network

This approach helped you identify each issue instead of guessing.

34. Final Architecture to Remember

If an interviewer asks:

"Explain your People Technology Manager project."

You can explain it like this:

I built and deployed a full-stack People Technology Manager
application on Amazon EKS.

The application consists of a React frontend, Node.js backend,
and MySQL database.

The React frontend is built using Vite and served through Nginx.
The frontend is exposed externally using a Kubernetes NodePort.

The Node.js backend is exposed internally using a ClusterIP
Service, and the frontend communicates with it through an Nginx
reverse proxy.

The backend communicates with MySQL using Kubernetes Service
Discovery through the mysql:3306 DNS name.

For database persistence, I created a 5Gi PersistentVolumeClaim.
The PVC dynamically provisions an AWS EBS volume through the
AWS EBS CSI Driver.

Database credentials are stored in a Kubernetes Secret, while
the MySQL initialization script is provided through a ConfigMap.

During deployment, I troubleshot several real Kubernetes issues,
including a Pending PVC caused by the missing EBS CSI Driver,
a MySQL CreateContainerConfigError caused by a missing Secret,
and a frontend API failure caused by localhost being used from
the browser.

I solved the frontend API issue using an Nginx reverse proxy.

The final flow is:

Browser
  ↓
NodePort
  ↓
Nginx
  ↓
React / API Proxy
  ↓
Node.js Backend
  ↓
MySQL
  ↓
PVC
  ↓
AWS EBS

The project successfully demonstrated the complete application path from React through Nginx, Kubernetes Services, Node.js, MySQL, PVC, and AWS EBS.

The one-line architecture

Internet → EKS NodePort → Nginx/React → Backend Service → Node.js → MySQL Service → PVC → AWS EBS