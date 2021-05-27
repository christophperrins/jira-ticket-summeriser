import axios from 'axios';
import readline from 'readline';
import fs from 'fs/promises'

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

let data = [];

const readData = () => {
  if (data && data.length === 0) {
    console.warn("It looks like you haven't initalised the data. Run 'new' or 'read-cache' if there is a cache present")
  }
  return data;
}

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
  console.log("getting data...")
  const maxIssueNumber = await numberOfIssues();
  const issues = []
  console.log(`Beginning to grab all ${maxIssueNumber} issues`)
  for (let count = 0; count < maxIssueNumber; count += 50) {
    console.log(`Grabbing ${count} to ${Math.min(count+50, maxIssueNumber)}`)
    const issues50 = await get50RowsOfData(count);
    issues.push(...issues50);
  }
  console.log("---")
  data = issues;
}

const storypointEstimatesFromOtherIssues = async () => {
  const data = readData()
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

const printSingle = async () => {
  const data = readData();
  const search = issueKey => data.filter(issue => issue.key === issueKey).forEach(issue => console.log(JSON.stringify(issue,null,2)))
  await question("Please type in a issue key: ").then(search);

  let another = true;
  while(another) {
    await question("Find another? (Y/N): ").then(async value => {
      let boolean = value.toUpperCase() === "Y"
      if (boolean) {
        await question("Please type in a issue key: ").then(search)
      } else {
        another = false;
      }
    })
  }
  return Promise.resolve();
}

const sprintSummary = () => {
  const data = readData();
  const sprints = {}
  const completedSprint = (issue) => issue['fields']["customfield_10006"] && issue['fields']["customfield_10006"]
    .sort((sprint1, sprint2) => new Date(sprint1.endDate) < new Date(sprint2.endDate) ? 1 : -1)[0];

  const completedIssues = data.filter(issue => issue.fields.status.name === "Done");
  completedIssues.forEach(issue => {
    const sprint = completedSprint(issue);
    if (!sprint) {
      return
    }
    if (!sprints[sprint.name]) {
      sprints[sprint.name] = sprint;
    }
    if (!sprints[sprint.name]["devs"]) {
      sprints[sprint.name]["devs"] = {}
    }
    const isAssigned = !!issue.fields.assignee;
    const assingee = issue.fields.assignee;
    if (!sprints[sprint.name]["devs"][isAssigned ? assingee.displayName : "Unassigned"]) {
      sprints[sprint.name]["devs"][isAssigned ? assingee.displayName : "Unassigned"] = []
    }
    sprints[sprint.name]["devs"][isAssigned ? assingee.displayName : "Unassigned"].push(issue);
    if (!sprints[sprint.name]["issues"]) {
      sprints[sprint.name]["issues"] = []
    }
    sprints[sprint.name]["issues"].push(issue)
  })
  const sprintsInOrder = Object.values(sprints).sort((sprint1, sprint2) => new Date(sprint1.endDate) < new Date(sprint2.endDate) ? 1 : -1)
  const sprintsOrderedByTimeIndexedByName = {};
  sprintsInOrder.forEach(sprint => {
    sprintsOrderedByTimeIndexedByName[sprint.name] = sprint
  })
  return sprintsOrderedByTimeIndexedByName;
}

const velocity = () => {
  const sumStoryPoints = (issues) => issues.map(issue => issue.fields[fieldInIssueWhichContainsStoryPoint])
  .reduce((count, issueStoryPoint) => count + issueStoryPoint, 0) 
  
  const sprints = sprintSummary();
  Object.keys(sprints).forEach(sprintName => {
    const sprint = sprints[sprintName]
    const sprintTotalSP = sumStoryPoints(sprint.issues)
    console.log(`${sprintName} total velocity: ${sprintTotalSP}`)
    const devsInSprint = sprint.devs;
    Object.keys(devsInSprint).forEach(devName => {
      const devSolvedIssues = devsInSprint[devName];
      const storiesPointsDone = sumStoryPoints(devSolvedIssues);
      console.log(`    ${devName}: ${storiesPointsDone}`)
    })
  })
  return Promise.resolve();
}

const cliInterface = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (question) => {
  return new Promise(resolve => {
    return cliInterface.question(question, value => {
      resolve(value)
    })
  })
}

const run = async () => {
  let continueApp = true;

  const decisions = {
    "new": {
      func: getAllData,
      description: "Type 'new' to get new information from atlassian"
    },
    "write-cache": {
      func: () => fs.writeFile("./cache.json", JSON.stringify(data)),
      description: "Type 'write-cache' to save information from atlassian"
    },
    "read-cache": {
      func: () => fs.readFile('./cache.json').then((buffer) => JSON.parse(buffer.toString())).then(cache => data = cache),
      description: "Type 'read-cache' to get locally cached information"
    },
    'storypoint-estimates': {
      func: storypointEstimatesFromOtherIssues,
      description: "Type 'storypoint-estimates' to print recent tickets"
    },
    "print-single": {
      func: printSingle,
      description: "Type 'print-single' for a single issue"
    },
    "velocity": {
      func: velocity,
      description: "Type 'velocity' to look at velocity of each developer across the sprint"
    },
    "exit": {
      func: () => process.exit(0),
      description: "Type 'exit' to exit application"
    },
    "default": {
      func: async () => console.log("Input not accepted"),
    },
  }

  while(continueApp) {
    Object.keys(decisions).forEach(key => decisions[key].description && console.log(decisions[key].description))
    await question("Please choose a value: ").then(async value => {
      const func = decisions[value] && decisions[value].func ? decisions[value].func : decisions["default"].func
      await func().then(() => console.log())
    })
  }
}

run();
