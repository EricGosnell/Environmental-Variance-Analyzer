**Amazon Web Services**

[https://aws.amazon.com/](https://aws.amazon.com/)

This is a table of the estimated costs broken down by each service we plan to use at this time. The space grant team said they expect active pods to be 30 at minimum and 125 at maximum. They also said they expect 90 to 375 total active users and data being collected 2 times a week to every single day. Below are the price estimates based on these maximums and minimums above.  
 

| Service | Minimum (Per month) | Maximum (Per Month) | Notes |
| :---- | :---- | :---- | :---- |
| AWS Amplify | $1-$5 | $10-$25 | Light traffic on website overall, 0.01$/min and 0.15$/GB |
| AWS Lambda | $0 | $1-$5 | 1M requests/month free, 400k GB seconds free. I say realistically even at the maximum 125 pods by 30 days of upload \= 3750 invocations/month which is probably about 10k-50k API reading/calls so just a few dollars but would be free for minimum. |
| Amazon S3 | $0.01-$0.10 | $1-$3 | $0.023/GB/Month, Worst Case 125 Pods by 30 uploads by 200kbish \= 750 MB/month |
| Amazon Dynamo DB | $0 | $2-$10 | Based on reads/writes \+ storage, free tier should cover most if not everything so added a little bit for the maximum just in case. The biggest worry is the schema is causing too many reads. |
| Amazon Cognito | $0 | $0 | Since we’re under the 10000 users it should be completely free since we have small scale of users |
| Total | $1.01-$5.10 | $14-$43 |  |

While this does show the difference between the minimum expected traffic and pods/data, it won’t be a hard jump from one to the other. I would expect that it would increase steadily over time based on how much hardware is available and how many users manage each pod. Since the EVA pods are still in development and the website might not see much if any traffic for a while, it is expected that the cost will remain near zero until coming to those minimum numbers as listed above, once there are more pods and users, those are the predicted costs per month. 

**Planned Services:**  
**Below are the services that are planned to be used on AWS, they have the name of the service followed by a brief description and then the link below.**

**AWS Amplify \- Frontend Hosting and Deployment**  
[https://aws.amazon.com/amplify/?nc2=type\_a](https://aws.amazon.com/amplify/?nc2=type_a)

**AWS Lambda \- Backend logic and NDJson file processing**  
[https://aws.amazon.com/lambda/?refid=ft\_s3](https://aws.amazon.com/lambda/?refid=ft_s3)

**Amazon S3 \- Store uploaded NDJson files**  
[https://aws.amazon.com/s3/?nc=sn\&loc=1\&refid=ap\_card](https://aws.amazon.com/s3/?nc=sn&loc=1&refid=ap_card)

**Amazon DynamoDB \- Database for parsed data and device locations**  
[https://aws.amazon.com/dynamodb/?refid=ap\_card](https://aws.amazon.com/dynamodb/?refid=ap_card)

**Amazon Cognito \- User authentication and authorization**  
[https://aws.amazon.com/cognito/?did=ap\_card\&trk=ap\_card](https://aws.amazon.com/cognito/?did=ap_card&trk=ap_card)

There are 3 layers to our website

* Frontend  
* Backend  
* Database

These 3 layers are deployed through specific services

* Frontend \- AWS Amplify  
* Backend \- AWS Lambda  
* Database \- Amazon DynamoDB

Below are some helpful links for deployment along with helpful tutorials and specifics on the services we planned to use. 

**Links to tutorials and information:**

AWS Amplify Documentation  
[https://docs.aws.amazon.com/amplify/](https://docs.aws.amazon.com/amplify/) 

AWS Lambda Documentation  
[https://docs.aws.amazon.com/lambda/](https://docs.aws.amazon.com/lambda/) 

Amazon DynamoDB Documentation  
[https://docs.aws.amazon.com/dynamodb/](https://docs.aws.amazon.com/dynamodb/) 

Amazon Cognito Documentation  
[https://docs.aws.amazon.com/cognito/](https://docs.aws.amazon.com/cognito/) 

Tutorial using AWS Amplify, AWS AppSync, AWS Lambda, Amazon DynamoDB: [https://docs.aws.amazon.com/hands-on/latest/build-web-app-s3-lambda-api-gateway-dynamodb/build-web-app-s3-lambda-api-gateway-dynamodb.html](https://docs.aws.amazon.com/hands-on/latest/build-web-app-s3-lambda-api-gateway-dynamodb/build-web-app-s3-lambda-api-gateway-dynamodb.html) 

Information on Front-End Web & Mobile \- Using an existing S3 bucket or DynamoDB:  
[https://aws.amazon.com/blogs/mobile/use-an-existing-s3-bucket-for-your-amplify-project/](https://aws.amazon.com/blogs/mobile/use-an-existing-s3-bucket-for-your-amplify-project/) 

Tutorial, this one specifically on task 2 talks more about Amazon Cognito and walks the user through it:  
[https://docs.aws.amazon.com/hands-on/latest/build-serverless-web-app-lambda-amplify-bedrock-cognito-gen-ai/build-serverless-web-app-lambda-amplify-bedrock-cognito-gen-ai.html](https://docs.aws.amazon.com/hands-on/latest/build-serverless-web-app-lambda-amplify-bedrock-cognito-gen-ai/build-serverless-web-app-lambda-amplify-bedrock-cognito-gen-ai.html)   
