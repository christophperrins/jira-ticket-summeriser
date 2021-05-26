import axios from 'axios';

const emailAddress = "ENTER EMAIL ADDRESS HERE"
const apiKey = "ENTER API KEY HERE"
const atlassianUrl = "https://XXXXXXXXXXX.atlassian.net"
const projectCode = "ENTER PROJECT CODE HERE";
const seeCardUrls = true;
const numberOfIssuesToPrint = 3;
const storyPointsUsed = [0,1,2,3,5,8,13,21,34,null];
const fieldInIssueWhichContainsStoryPoint = "customfield_10804";



const authorizationCode = Buffer.from(`${emailAddress}:${apiKey}`).toString("base64");
const authorization = `Basic ${authorizationCode}`

const numberOfIssues = () => {
  return axios.get(`${atlassianUrl}/rest/api/latest/search?jql=project="${projectCode}"&maxResults=0`, {
    headers: {
        Accept: "*/*",
        Authorization: authorization
    }
  }).then(response => response.data.total);
}

const get50RowsOfData = (startAt) => {
  return axios.get(`${atlassianUrl}/rest/api/latest/search?jql=project="${projectCode}"&startAt=${startAt}`, {
    headers: {
        Accept: "*/*",
        Authorization: authorization
    }
  }).then(response => response.data.issues);
}

const getAllData = async () => {
  const maxIssueNumber = await numberOfIssues();
  const issues = []
  console.log(`Beginning to grab all ${maxIssueNumber} issues`)
  for (let count = 0; count < maxIssueNumber; count += 50) {
    console.log(`Grabbing ${count} to ${Math.min(count+50, maxIssueNumber)}`)
    const issues50 = await get50RowsOfData(count);
    issues.push(...issues50);
  }
  return issues;
}

const printInformationOnIssuesWithStoryPoints = (data) => {
  const filterWithStoryPoint = (number) => {
    const isNumber = Number.isInteger(number);
    const filteredData = isNumber ? data.filter(data => parseInt(data.fields[fieldInIssueWhichContainsStoryPoint]) === number) : data.filter(data => data.fields[fieldInIssueWhichContainsStoryPoint] === number)
    return filteredData;
  }

  const printSingleLine = (issues) => {
    const mostRecentIssuesString = issues.reduce((prev, current) => prev + " " + current, "");
    mostRecentIssuesString && console.log(mostRecentIssuesString)
  }

  const printCardUrls = (issues) => {
    issues.forEach(issue => console.log(`${atlassianUrl}/browse/${issue}`))
  }

  storyPointsUsed.forEach(storyPoint => {
    const dataWithStoryPoint = filterWithStoryPoint(storyPoint);
    console.log(`stories with ${storyPoint}: ${dataWithStoryPoint.length}`);
    const mostRecentIssues = dataWithStoryPoint.filter((_, i) => i < numberOfIssuesToPrint).map(issue => issue["key"]);
    seeCardUrls ? printCardUrls(mostRecentIssues) : printSingleLine(mostRecentIssues)
  })
} 

const run = async () => {
    console.log("getting data...")
    const data = await getAllData();
    console.log('---')
    
    printInformationOnIssuesWithStoryPoints(data)
}


run();
