import { useEffect, useState } from "react";
import { Web5 } from "@web5/api";

export default function Home() {
  // web5 and did state
  const [web5, setWeb5] = useState(null);
  const [myDid, setMyDid] = useState(null);
  const [receivedDings, setReceivedDings] = useState([]);
  const [noteValue, setNoteValue] = useState("");
  const [recipientDid, setRecipientDid] = useState("");
  const [error, setError] = useState('');

  // initialize web5 and set DID
  const initializeWeb5 = async () => {
    const { web5, did } = await Web5.connect();
    setWeb5(web5);
    setMyDid(did);
  };

  // configure the protocol
  const configureProtocol = async (web5) => {
    // define the protocol
    const dingerProtocolDefinition = {
      protocol: "https://blackgirlbytes.dev/dinger-protocol",
      published: true,
      types: {
        ding: {
          schema: "ding",
          dataFormats: ["application/json"],
        },
      },
      structure: {
        ding: {
          $actions: [
            { who: "anyone", can: "write" },
            { who: "author", of: "ding", can: "read" },
            { who: "recipient", of: "ding", can: "read" },
          ],
        },
      },
    };
    // query for the protocol
    const { protocols, status: protocolStatus } = await web5.dwn.protocols.query({
      message: {
        filter: {
          protocol: "https://blackgirlbytes.dev/dinger-protocol",
        },
      },
    });
    // handle query results
    if (protocolStatus.code !== 200 || protocols.length === 0) {
      const { status } = await web5.dwn.protocols.configure({
        message: {
          definition: dingerProtocolDefinition,
        },
      });
      console.log("Configure protocol status", protocolStatus);
    }
  };

  // fetch dings
  const fetchDings = async (web5) => {
    const { records, status: recordStatus } = await web5.dwn.records.query({
      message: {
        filter: {
          protocol: "https://blackgirlbytes.dev/dinger-protocol",
          protocolPath: "ding",
        },
      },
    });

    try {
      const results = await Promise.all(
        records.map(async (record) => await record.data.json())
      );
      console.log("queried results", results);
    } catch (error) {
      console.error(error);
    }

    if (recordStatus.code == 200) {
      const received = records.filter(
        (record) => record.data.recipient === myDid
      );
      setReceivedDings(received);
    }
  };

  // useEffect initialize web5, configure protocols, and fetch dings
  useEffect(() => {
    const initWeb5 = async () => {
      await initializeWeb5();
      if (web5) {
        await configureProtocol(web5);
        // await fetchDings(web5);
      }
    };
  
    initWeb5();
  }, [web5]);

  // useEffect(() => {
  //   const intervalId = setInterval(async () => {
  //     if (web5 && myDid) {
  //       await fetchDings(web5); // Assuming fetchDings queries for dings where the recipient is myDid
  //     }
  //   }, 10000); // Run every 10 seconds
    
  //   return () => clearInterval(intervalId); // Clear interval on component unmount
  // }, [web5, myDid]);
  
  const constructDing = () => {
    const currentDate = new Date().toLocaleDateString();

    const ding = {
      sender: myDid,
      note: noteValue,
      recipient: recipientDid,
      timestampWritten: `${currentDate}`,
    };
    return ding;
  };

  const writeToDwn = async (ding) => {
    return await web5.dwn.records.create({
      data: ding,
      message: {
        protocol: "https://blackgirlbytes.dev/dinger-protocol",
        protocolPath: "ding",
        schema: "ding",
        recipient: recipientDid,
      },
    });
  };

  const sendRecord = async (record) => {
    return await record.send(recipientDid);
  };

  const validateInput = (recipientDid, noteValue) => {
    if (recipientDid.length === 0) {
      return 'DID required';
    }
    
    if (noteValue.length === 0) {
      return 'Note required';
    }
      return null; 
  };
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Validate input
    const error = validateInput(recipientDid, noteValue);
    if (error) {
      setError(error);
      return;
    }

    // Create ding object
    const ding = constructDing();

    console.log('here is the ding', ding)

    try {
      // Write record
      const { record, status } = await writeToDwn(ding);
      if (status.code !== 202)
        throw new Error(`${status.code} - ${status.detail}`);

        console.log('here is the record', record)

      // Send record
      const { status: sendStatus } = await sendRecord(record);
      if (sendStatus.code !== 202)
        throw new Error(`${sendStatus.code} - ${sendStatus.detail}`);

      // Fetch dings and alert user
      await fetchDings();
      console.log(`Successfully sent ${noteValue} to ${recipientDid}!`);
    } catch (e) {
      // Handle errors
      setError(e.message);
    }
  };

  // handle copy DID
  const handleCopyDid = async () => {
    if (myDid) {
      try {
        await navigator.clipboard.writeText(myDid);
        console.log("DID copied to clipboard", myDid);
      } catch (err) {
        alert("Failed to copy DID: " + err);
      }
    }
  };

  return (
    <div className="app-page">
      <div className="form">
        <button id="copy-did" onClick={handleCopyDid}>
          Copy your DID
        </button>
        
        <form id="ding-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter DID"
            value={recipientDid}
            onChange={(e) => setRecipientDid(e.target.value)}
          />
          <input
            type="text"
            placeholder="Enter Note"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
          />
          <button type="submit">Ding</button>
          {error && <p className="message">{error}</p>}
        </form>
        
        <h2>Dinged by</h2>
        <ul id="dinged-by-list">
          {receivedDings.map((ding, index) => (
            <li key={index}>
              <p>{ding.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
  
}
