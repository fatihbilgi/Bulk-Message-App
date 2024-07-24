import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import Select from 'react-select';
import { ThreeDots } from 'react-loader-spinner';
import LoginPage from './LoginPage';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const firestore = getFirestore();

const bitrixApiKey = process.env.BITRIX_API_KEY;
const bitrixBaseUrl = `https://clinicwise.bitrix24.com/rest/729/${bitrixApiKey}/`;

const fetchOptionsFromBitrix24 = async (id, setter) => {
  try {
    const response = await axios.post(`${bitrixBaseUrl}crm.deal.userfield.get`, { id });
    const data = response.data.result.LIST;
    const optionsFromApi = data.map(item => ({ value: item.ID.toString(), label: item.VALUE }));
    setter(optionsFromApi);
  } catch (error) {
    console.error(`Error fetching options with ID ${id}:`, error);
  }
};

const fetchResponsiblesFromBitrix24 = async (id, setter) => {
  try {
    const response = await axios.post(`${bitrixBaseUrl}user.get`, {
      filter: { ACTIVE: 'Y', UF_DEPARTMENT: [5, 7] }
    });
    const data = response.data.result;
    const optionsFromApi = data.map(item => ({ value: item.ID.toString(), label: item.NAME + " " + item.LAST_NAME }));
    setter(optionsFromApi);
  } catch (error) {
    console.error(`Error fetching options with ID ${id}:`, error);
  }
};


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filteredDeals, setFilteredDeals] = useState([]);
  const [fetchedContacts, setFetchedContacts] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [doctorFilter, setDoctorFilter] = useState([]);
  const [stageFilter, setStageFilter] = useState([]);
  const [langFilter, setLangFilter] = useState([]);
  const [respFilter, setRespFilter] = useState([]);
  const [reasonFilter, setReasonFilter] = useState([]);
  const [channelList, setChannelList] = useState([]);
  const [templateList, setTemplateList] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateValues, setTemplateValues] = useState(['']);
  const [messageStatuses, setMessageStatuses] = useState({});
  const [reasonOptions, setReasonOptions] = useState([]);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [langOptions, setLangOptions] = useState([]);
  const [respOptions, setRespOptions] = useState([]);

  const stageOptions = [
    { value: 'NEW', label: 'New' },
    { value: '4', label: 'Data Collection' },
    { value: 'UC_SXWMDD', label: 'Connected' },
    { value: 'UC_REA3TG', label: 'Form Received' },
    { value: '10', label: 'Consultation (Other)' },
    { value: '2', label: 'Consultation' },
    { value: '8', label: 'Miss Info' },
    { value: '5', label: 'Not Suitable For Surgery' },
    { value: '3', label: 'Suitable For Surgery' },
    { value: '1', label: 'Quote(Offer)' },
    { value: 'UC_E6D6QY', label: 'Hot Stage' },
    { value: '6', label: 'Dep. Without Date' },
    { value: '7', label: 'Deposit Received' },
    { value: 'WON', label: 'Deal Won' },
    { value: 'LOSE', label: 'Deal Lost' }
  ];

  useEffect(() => {
    fetchOptionsFromBitrix24(510, setDoctorOptions);
    fetchOptionsFromBitrix24(1063, setLangOptions);
    fetchOptionsFromBitrix24(396, setReasonOptions);
    fetchResponsiblesFromBitrix24(null, setRespOptions);
  }, []);


  const wazzupBaseUrl = "https://api.wazzup24.com/v3/";
  const wazzupApiKey = process.env.WAZZUP_API_KEY;

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch(`${wazzupBaseUrl}channels`, {
          headers: {
            "Authorization": `Bearer ${wazzupApiKey}`
          }
        });
        const data = await response.json();
        setChannelList(data);

        if (data.length > 0) {
          setSelectedChannelId(data[0].channelId);
        }
      } catch (error) {
        console.error("Error fetching channels:", error);
      }
    };

    const fetchTemplates = async () => {
      try {
        const response = await fetch(`${wazzupBaseUrl}templates/whatsapp?limit=250`, {
          headers: {
            "Authorization": `Bearer ${wazzupApiKey}`
          }
        });
        const data = await response.json();
        setTemplateList(data);

        if (data.length > 0) {
          setSelectedTemplateId(data[0].templateGuid);
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
      }
    };

    fetchChannels();
    fetchTemplates();
  }, []);


  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Webhook event received:", data);
      const { messages } = data;
      if (messages && messages.length > 0) {
        messages.forEach(message => {
          const { messageId, status } = message;
          setMessageStatuses(prevStatuses => {
            const updatedStatuses = { ...prevStatuses };
            Object.keys(updatedStatuses).forEach(dealId => {
              if (updatedStatuses[dealId].messageId === messageId) {
                updatedStatuses[dealId].status = status;
              }
            });
            return updatedStatuses;
          });
        });
      }
    };

    return () => {
      ws.close();
    };
  }, []);


  const updateStatuses = async () => {
    try {
      const querySnapshot = await getDocs(collection(firestore, 'webhookData'));
      const newStatuses = {};

      querySnapshot.forEach(doc => {
        const data = doc.data();
        const messageId = doc.id;
        const status = data.status;

        Object.keys(messageStatuses).forEach(dealId => {
          if (messageStatuses[dealId].messageId === messageId) {
            newStatuses[dealId] = { ...messageStatuses[dealId], status };
          }
        });
      });

      setMessageStatuses(prevStatuses => ({ ...prevStatuses, ...newStatuses }));
    } catch (error) {
      console.error('Error updating statuses:', error);
    }
  };


  const handleTemplateValueChange = (index, value) => {
    const updatedTemplateValues = [...templateValues];
    updatedTemplateValues[index] = value;
    setTemplateValues(updatedTemplateValues);
  };

  const logMessageSent = async (template, filters, timestamp) => {
    try {
      const selectedTemplate = templateList.find(template => template.templateGuid === selectedTemplateId);

      let templateBody = selectedTemplate.components.find(component => component.type === 'BODY').text;


      selectedTemplate.components.forEach(component => {
        if (component.type === 'BODY' && component.text.includes('{{')) {
          const variableRegex = /{{\d+}}/g;
          const variables = component.text.match(variableRegex);
          variables.forEach(variable => {
            const index = parseInt(variable.match(/\d+/)[0]) - 1;
            const value = templateValues[index] || '';
            templateBody = templateBody.replace(variable, value);
          });
        }
      });

      const logRef = collection(firestore, 'messageLogs');
      await addDoc(logRef, {
        templateBody: templateBody,
        filters: filters,
        timestamp: timestamp
      });
      console.log('Message sent logged successfully');
    } catch (error) {
      console.error('Error logging message sent:', error);
    }
  };

  const handleFilterApply = async () => {

    if (
      doctorFilter.length === 0 &&
      stageFilter.length === 0 &&
      langFilter.length === 0 &&
      reasonFilter.length === 0 &&
      respFilter.length === 0 &&
      startDate.length === 0 &&
      endDate.length === 0

    ) {
      alert("Please select at least one filter.");
      return;
    }
    setLoading(true);
    try {
      const filters = {
        "CATEGORY_ID": 0,
        "UF_CRM_1646910708": [3117, null]

      };

      if (startDate) { filters[">=DATE_CREATE"] = startDate; }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filters["<=DATE_CREATE"] = endDateTime.toISOString();
      }
      if (respFilter.length > 0) { filters["ASSIGNED_BY_ID"] = respFilter; }
      if (doctorFilter.length > 0) { filters["UF_CRM_1614780869409"] = doctorFilter; }
      if (stageFilter.length > 0) { filters["STAGE_ID"] = stageFilter; }
      if (langFilter.length > 0) { filters["UF_CRM_1645705625"] = langFilter; }
      if (reasonFilter.length > 0) { filters["UF_CRM_1610457905592"] = reasonFilter; }

      let start = 0;
      let allDeals = [];

      while (true) {
        const response = await axios.post(`${bitrixBaseUrl}crm.deal.list`, {
          select: ["*", "UF_*"],
          filter: filters,
          start
        });
        let deals = response.data.result;

        deals.sort((a, b) => new Date(b.DATE_CREATE) - new Date(a.DATE_CREATE));

        allDeals = [...allDeals, ...deals];

        if (deals.length < 50) {
          break;
        }

        start += 50;
      }

      setFilteredDeals(allDeals);

      let startC = 0;
      let allContacts = [];

      while (true) {
        const contactIds = allDeals.map(deal => deal.CONTACT_ID);
        const contactResponse = await axios.post(`${bitrixBaseUrl}crm.contact.list`, {
          select: ["*", "UF_*", "PHONE", "EMAIL"],
          filter: {
            ID: contactIds
          },
          start: startC
        });
        const contacts = contactResponse.data.result;
        allContacts = [...allContacts, ...contacts];
        if (contacts.length < 50) {
          break;
        }
        startC += 50;
      }
      setFetchedContacts(allContacts);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessageToAll = async () => {
    const timestamp = new Date();
    setLoading(true);
    try {
      const responses = await Promise.all(
        filteredDeals.map(async (deal, index) => {
          const contact = fetchedContacts.find(contact => contact.ID === deal.CONTACT_ID);
          const destination = contact && contact.PHONE && contact.PHONE.length > 0 ? contact.PHONE[0].VALUE : '';
          const messageId = await sendMessage(destination, deal.ID);
          return { dealId: deal.ID, messageId };
        })
      );

      const messageIdMap = {};
      responses.forEach(({ dealId, messageId }) => {
        messageIdMap[dealId] = { messageId, status: 'Pending' }; // İlk olarak 'Pending' olarak ayarla
      });
      setMessageStatuses(messageIdMap);
      logMessageSent(selectedTemplate, { doctorFilter, stageFilter, langFilter, respFilter, startDate, endDate }, timestamp);

    } catch (error) {
      console.error('Error sending messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (destination, dealId) => {
    try {
      const selectedTemplate = templateList.find(template => template.templateGuid === selectedTemplateId);

      const requestBody = {
        channelId: selectedChannelId,
        chatType: "whatsapp",
        chatId: destination,
        templateId: selectedTemplateId,
        templateValues: templateValues.map(value => value || '')
      };

      selectedTemplate.components.forEach(component => {
        if (component.type === 'BODY' && component.text.includes('{{')) {
          const variableRegex = /{{\d+}}/g;
          const variables = component.text.match(variableRegex);
          variables.forEach(variable => {
            const index = parseInt(variable.match(/\d+/)[0]) - 1;
            const value = templateValues[index] || '';
            requestBody.templateValues[index] = value;
          });
        }
      });

      const response = await fetch(`${wazzupBaseUrl}message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${wazzupApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      await sendComment(dealId, `Group Message Sent: "${selectedTemplate.components.find(component => component.type === 'BODY').text}"`);
      console.log(data.messageId);
      return data.messageId;

    } catch (error) {
      console.error("Error sending message:", error);
    }
  };


  const sendComment = async (dealId) => {
    try {
      const selectedTemplate = templateList.find(template => template.templateGuid === selectedTemplateId);

      let commentText = selectedTemplate.components.find(component => component.type === 'BODY').text;

      selectedTemplate.components.forEach(component => {
        if (component.type === 'BODY' && component.text.includes('{{')) {
          const variableRegex = /{{\d+}}/g;
          const variables = component.text.match(variableRegex);
          variables.forEach(variable => {
            const index = parseInt(variable.match(/\d+/)[0]) - 1;
            const value = templateValues[index] || '';
            commentText = commentText.replace(variable, value);
          });
        }
      });

      await axios.post(`${bitrixBaseUrl}crm.timeline.comment.add`, {
        fields: {
          ENTITY_ID: dealId,
          ENTITY_TYPE: "deal",
          COMMENT: `Group message sent successfully\nMessage: "${commentText}"`
        }
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setDoctorFilter([]);
    setStageFilter([]);
    setLangFilter([]);
    setRespFilter([]);
    setReasonFilter([]);
    setFilteredDeals([]);
    setFetchedContacts([]);
  };


  const channelOptions = channelList.map((channel) => ({
    value: channel.channelId,
    label: channel.name
  }));

  const templateOptions = templateList.map((template) => ({
    value: template.templateGuid,
    label: template.title
  }));

  const selectedTemplate = templateList.find(template => template.templateGuid === selectedTemplateId);


  return (
    <div className="App">
      <div className="header">
        <img src={require("./logo.png")} alt="Clinic Wise" className="logo" />
      </div>
      {!isLoggedIn && <LoginPage onLogin={() => setIsLoggedIn(true)} />}
      {isLoggedIn && (<>
        <div className="container">
          <div className="filters-container">
            <div className="filters">
              <label>Start Date:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <label>End Date:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <label>Responsible:</label>
              <Select
                options={respOptions}
                value={respOptions.filter(option => respFilter.includes(option.value))}
                onChange={(selectedOptions) => setRespFilter(selectedOptions.map(option => option.value))}
                isMulti
              />
              <label>Doctor:</label>
              <Select
                options={doctorOptions}
                value={doctorOptions.filter(option => doctorFilter.includes(option.value))}
                onChange={(selectedOptions) => setDoctorFilter(selectedOptions.map(option => option.value))}
                isMulti
              />
              <label>Stage:</label>
              <Select
                options={stageOptions}
                value={stageOptions.filter(option => stageFilter.includes(option.value))}
                onChange={(selectedOptions) => setStageFilter(selectedOptions.map(option => option.value))}
                isMulti
              />
              <label>Language:</label>
              <Select
                options={langOptions}
                value={langOptions.filter(option => langFilter.includes(option.value))}
                onChange={(selectedOptions) => setLangFilter(selectedOptions.map(option => option.value))}
                isMulti
              />
              <label>Reason:</label>
              <Select
                options={reasonOptions}
                value={reasonOptions.filter(option => reasonFilter.includes(option.value))}
                onChange={(selectedOptions) => setReasonFilter(selectedOptions.map(option => option.value))}
                isMulti
              />
              <button className="filter-button" onClick={handleFilterApply}>Apply Filter</button>
              <button className="clear-button" onClick={clearFilters}>Clear Filters</button>
            </div>
          </div>
          <div className="data-container">
            <div className="templates-container">
              <h2>Channels & Templates</h2>
              <div className='channel'>
                <label>Select Channel</label>
                <Select
                  options={channelOptions}
                  placeholder="Select Channel"
                  value={channelOptions.find(option => option.value === selectedChannelId)}
                  onChange={(selected) => setSelectedChannelId(selected.value)}
                />
              </div>
              <div>
                <label>Select Template</label>
                <Select
                  options={templateOptions}
                  placeholder="Select Template"
                  value={templateOptions.find(option => option.value === selectedTemplateId)}
                  onChange={(selected) => setSelectedTemplateId(selected.value)}
                />
              </div>
              <p>{selectedTemplate.components.find(component => component.type === 'BODY').text}</p>
            </div>
            <div className="message-container">
              {selectedTemplate && selectedTemplate.components.some(component => component.type === 'BODY' && component.text.includes('{{')) && (
                <div>
                  {selectedTemplate.components.map((component, index) => {
                    if (component.type === 'BODY' && component.text.includes('{{')) {
                      const variableRegex = /{{\d+}}/g;
                      const variables = component.text.match(variableRegex);

                      return (
                        <div key={index}>
                          {variables.map((variable, variableIndex) => (
                            <div key={variableIndex}>
                              <label>{`Template Value ${variableIndex + 1}:`}</label>
                              <textarea
                                className='message-input'
                                placeholder={`Enter value for ${variable}`}
                                value={templateValues[variableIndex] || ''}
                                onChange={(e) => handleTemplateValueChange(variableIndex, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    } else {
                      return null;
                    }
                  })}
                </div>
              )}
              <button className="send-button" onClick={sendMessageToAll} disabled={loading}>Send Message to All</button>
              <button className="update-button" onClick={updateStatuses}>Update Statuses</button>
            </div>
            <div className="loader-container">
              {loading && filteredDeals.length > 0 ? (
                <ThreeDots color="#00BFFF" height={50} width={50} className="loader" />
              ) : filteredDeals.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Deal Name</th>
                      <th>Responsible</th>
                      <th>Created Date</th>
                      <th>Language</th>
                      <th>Doctor</th>
                      <th>Stage</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map((deal, index) => {
                      const contact = fetchedContacts.find(contact => contact.ID === deal.CONTACT_ID);
                      const destination = contact && contact.PHONE && contact.PHONE.length > 0 ? contact.PHONE[0].VALUE : '';
                      const stageLabel = stageOptions.find(option => option.value === deal.STAGE_ID)?.label || '';
                      const doctorName = doctorOptions.find(option => option.value === deal.UF_CRM_1614780869409)?.label || '';
                      const langName = langOptions.find(option => option.value === deal.UF_CRM_1645705625)?.label || '';
                      const createDate = deal.DATE_CREATE.substring(0, 10);
                      const respName = respOptions.find(option => option.value === deal.ASSIGNED_BY_ID)?.label || '';

                      return (
                        <tr key={deal.ID}>
                          <td>{index + 1}</td>
                          <td>{deal.TITLE}</td>
                          <td>{respName}</td>
                          <td>{createDate}</td>
                          <td>{langName}</td>
                          <td>{doctorName}</td>
                          <td>{stageLabel}</td>
                          <td>{destination}</td>
                          <td>{contact && contact.EMAIL && contact.EMAIL.length > 0 ? contact.EMAIL[0].VALUE : ''}</td>
                          <td>{messageStatuses[deal.ID]?.status || 'Not Sent'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p>No data matching these filters</p>
              )}
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
export default App;
