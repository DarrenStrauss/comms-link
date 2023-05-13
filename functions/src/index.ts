import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

interface ConnectionData {
    password?: string;
    offer?: string;
    answer?: string;
}

function sendSuccessResponse(response: functions.Response, data: string) {
  return response.status(200).json({success: true, data});
}

function sendErrorResponse(response: functions.Response, status: number, message: string) {
  return response.status(status).json({success: false, error: message});
}

/**
 * Checks if a connection name is valid.
 * Valid names are non-empty strings and are limited to 100 characters.
 *
 * @param connectionName The name to check
 * @returns true if the name is valid, otherwise false
 */
function isValidConnectionName(connectionName: string) {
  if (!connectionName || connectionName.length > 100) {
    return false;
  }

  return true;
}

/**
 * Function for publishing a new connection offer.
 * The request body should contain a connection name, password and an offer SDP.
 * This will result in a new document created in the database, with the document ID equal to the connection name.
 */
exports.connectionOffer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const connectionName: string = request.body.connectionName?.toString() ?? "";

  if (!isValidConnectionName(connectionName)) {
    sendErrorResponse(response, 403, "Invalid connection name");

    return;
  }

  const offer: ConnectionData = {
    password: request.body.password ?? "",
    offer: request.body.offer ?? ""
  };

  if (!offer.offer) {
    sendErrorResponse(response, 403, "Invalid offer");

    return;
  }

  const connectionDocumentData = admin.firestore().collection("connections").doc(connectionName);

  try {
    await connectionDocumentData.set(offer, {merge: true});
    sendSuccessResponse(response, "Success");
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for retrieving a connection offer SDP.
 * The request query parameters should contain the connection name and a matching password.
 */
exports.getOffer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const connectionName: string = request.query.connectionName?.toString() ?? "";
  const requestPassword: string = request.query.password?.toString() ?? "";

  if (!isValidConnectionName(connectionName)) {
    sendErrorResponse(response, 403, "Invalid connection name");

    return;
  }

  const connectionDocumentData = await admin.firestore().collection("connections").doc(connectionName).get();

  try {
    if (connectionDocumentData.exists) {
      const offer = connectionDocumentData.get("offer");
      const storedPassword = connectionDocumentData.get("password")?.toString();

      if (storedPassword) {
        if (requestPassword != storedPassword) {
          sendErrorResponse(response, 403, "Invalid or incorrect password");

          return;
        }
      }
      sendSuccessResponse(response, offer);
    } else {
      sendErrorResponse(response, 404, "Connection offer not found");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for publishing an answer SDP for an existing offer.
 * The request body should contain the connection name, password and an answer SDP.
 */
exports.connectionAnswer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const connectionName: string = request.body.connectionName?.toString() ?? "";
  const requestPassword: string = request.body.password?.toString() ?? "";

  if (!isValidConnectionName(connectionName)) {
    sendErrorResponse(response, 403, "Invalid connection name");

    return;
  }

  const connectionDocument = admin.firestore().collection("connections").doc(connectionName);
  const connectionDocumentData = await connectionDocument.get();

  try {
    if (connectionDocumentData.exists) {
      const storedPassword = connectionDocumentData.get("password")?.toString();

      if (storedPassword) {
        if (requestPassword != storedPassword) {
          sendErrorResponse(response, 403, "Invalid or incorrect password");

          return;
        }
      }
      if (!connectionDocumentData.get("offer")) {
        sendErrorResponse(response, 403, "Connection offer not found");

        return;
      }
      const answer: ConnectionData = {answer: request.body.answer ?? ""};
      await connectionDocument.set(answer, {merge: true});
      sendSuccessResponse(response, "Success");
    } else {
      sendErrorResponse(response, 404, "Connection offer not found");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});

/**
 * Function for retrieving an answer SDP.
 * The request query parameters should contain the connection name.
 */
exports.getAnswer = functions.region("australia-southeast1").https.onRequest(async (request, response) => {
  const connectionName: string = request.query.connectionName?.toString() ?? "";

  if (!isValidConnectionName(connectionName)) {
    sendErrorResponse(response, 403, "Invalid connection name");

    return;
  }

  const connectionDocumentData = await admin.firestore().collection("connections").doc(connectionName).get();

  try {
    if (connectionDocumentData.exists) {
      const answer = connectionDocumentData.get("answer");

      if (answer) {
        sendSuccessResponse(response, answer);
      } else {
        sendErrorResponse(response, 404, "Connection answer not found");
      }
    } else {
      sendErrorResponse(response, 403, "Connection does not exist");
    }
  } catch (error) {
    sendErrorResponse(response, 500, `Error: ${error}`);
  }
});
