import { LightningElement, track, wire } from 'lwc';
import { getListUi } from 'lightning/uiListApi';
import { updateRecord } from 'lightning/uiRecordApi';
import { refreshApex } from '@salesforce/apex';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import getProductionSchedulingByDate from '@salesforce/apex/GF_ProductionSchedulingController.getProductionSchedulingByDate';
import getCurrencyTypes from '@salesforce/apex/GF_ProductionSchedulingController.getCurrencyTypes';
import getSOs from '@salesforce/apex/GF_ProductionSchedulingController.getSOs';
import getAllUsers from '@salesforce/apex/GF_ProductionSchedulingController.getAllUsers';
import getOpp from '@salesforce/apex/GF_ProductionSchedulingController.getOpp';

import OPPORTUNITY_OBJECT from '@salesforce/schema/Opportunity';
import STAGE_FIELD from '@salesforce/schema/Opportunity.StageName';
import PRODUCTION_SCHEDULING_FIELD from '@salesforce/schema/Opportunity.Production_Scheduling__c';
import ID_FIELD from '@salesforce/schema/Opportunity.Id';
import GF_Team_Logos from '@salesforce/resourceUrl/GF_Team_Logos';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation'


export default class GfProductionScheduling extends NavigationMixin(LightningElement) {
    records
    usersOptions
    selectedUsers
    pickVals
    recordId
    PSList
    recordTypeId
    oppIds = [];
    SOIds = [];
    //GF_Team_Logos = GF_Team_Logos;
    currencyExchange;
    @track startingDate = "" + new Date().getFullYear() + "-" + ((new Date().getMonth() + 1) > 9 ? (new Date().getMonth() + 1) : "0" + (new Date().getMonth() + 1)) + "-" + new Date().getDate()
    @track WeekNo = 16;
    currencyValue = 'All';
    get currencyOptions() {
        return [
            // { label: 'CAD', value: 'CAD' },
            // { label: 'USD', value: 'USD' },
            { label: 'All', value: 'All' },
        ];
    }

    // get isCAD(){
    //     return this.currencyValue == 'CAD';
    // }
    // get isUSD(){
    //     return this.currencyValue == 'USD';
    // }
    get isMixed(){
        return this.currencyValue == 'All';
    }
    handleCurrencyChange(event){
        this.currencyValue = event.target.value;
    }
    connectedCallback() {
        var d = this.getFirstDayOfLastWeek();
        this.startingDate = "" + d.getFullYear() + "-" + ((d.getMonth() + 1) > 9 ? (d.getMonth() + 1) : "0" + (d.getMonth() + 1)) + "-" + d.getDate()
        getCurrencyTypes().then(result => {
            this.currencyExchange = result;
            //this.handleUpdateTable();

        }).catch(err => {});
        getAllUsers().then(result => {
            var selectedAll = [];
            this.usersOptions = result.map(item => {
                selectedAll.push(item.Name);
                return { label: item.Name, value: item.Id }
            });
            this.template.querySelector('[role="cm-picklist"]').setOptions(this.usersOptions);
            //this.template.querySelector('[role="cm-picklist"]').setSelectedList(selectedAll.join(';'));
        }).catch(error => {
            console.log(error);
        });
    }
    getFirstDayOfLastWeek() {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 28); // Subtract 7 days to go back one week
        // Find the first day (Sunday) of the last week
        lastWeek.setDate(lastWeek.getDate() - (lastWeek.getDay() + 1) % 7);
        lastWeek.setDate(lastWeek.getDate() + 2);

        return lastWeek;
    }
    /*** fetching Opportunity lists ***/
    @wire(getListUi, {
        objectApiName: OPPORTUNITY_OBJECT,
        listViewApiName: 'Production_Scheduler',
        pageSize: 500
    }) wiredListView({ error, data }) {
        this.oppIds = [];
        this.SOIds = [];
        if (data) {
            this.records = data.records.records.map(item => {
                let field = item.fields
                let account = field.Account.value.fields
                let SOName = (field.Sales_Order__r != null && field.Sales_Order__r.displayValue != null? field.Sales_Order__r.displayValue : (field.GF_Sales_Order__c != null && field.GF_Sales_Order__c.value != null? field.GF_Sales_Order__c.value: ''));
                let SOId = (field.Sales_Order__r != null && field.Sales_Order__r.value != null ? field.Sales_Order__r.value.id : '');
                let PSName = (field.Production_Scheduling__r != null && field.Production_Scheduling__r.value != null ? field.Production_Scheduling__r.displayValue : (field.StageName.value != null ? field.StageName.value : ''));
                let cardClass = '';
                /*if(field.Synced_Quote_Status__c.value && field.Synced_Quote_Status__c.value == 'Sent to Dealer' && SOName == ''){
                    cardClass = ' card-red';
                } else if(field.Synced_Quote_Status__c.value && field.Synced_Quote_Status__c.value == 'Approved by Dealer' && SOName == ''){
                    cardClass = ' card-yellow';
                }else if((field.Synced_Quote_Status__c.value && field.Synced_Quote_Status__c.value == 'In Production') || SOName != ''){
                    cardClass = ' slds-theme_success';
                }*/
                if(field.StageName && field.StageName.value == 'Pending Dealer Confirmation') {
                    cardClass = ' card-yellow';
                } else if(field.StageName && field.StageName.value == 'Closed Won') {
                    cardClass = ' slds-theme_success';
                }
                this.oppIds.push(field.Id.value);
                if(SOId != ''){
                    this.SOIds.push(SOId);
                }
                return {
                    'Id': field.Id.value,
                    'Name': field.Name.value,
                    //'State': field.State__c.value,
                    //'City': field.City__c.value,
                    'AccountId': account.Id.value,
                    'AccountName': account.Name.value,
                    'CloseDate': SOName,
                    'SOId': SOId,
                    'isAllShipped': (field.SO_Status__c.value == 'All Shipped' || field.SO_Status__c.value == 'Completed'? true: false),
                    'StageName': PSName/*field.StageName.value*/,
                    'Amount': field.Amount.value,
                    'cardClass': 'slds-item slds-var-m-around_small' + cardClass,
                    'currency': field.CurrencyIsoCode.value,
                    'tcfAccount': field.TCF_Account__c.value,
                    'SellToCustomerOwnerName': '' // Initialize, will be populated from Sales Order data
                }
                
            });
            getOpp({oppIds: this.oppIds}).then(result => {
                result.forEach(opp => {
                    const foundItem = this.records.find(item => item.Id === opp.Id);
                    if(foundItem){
                        foundItem.OwnerName = opp.Owner.Name;
                        //foundItem.isTeamLogo = true;
                        // if(opp.Owner.Team__c){
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/' + opp.Owner.Team__c + '.png';
                        // }
                        // if(foundItem.OwnerName == 'Dale Cornell') {
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Coyotes.png';
                        // }
                        // if(foundItem.OwnerName == 'Anthony Truan' || foundItem.OwnerName == 'Nikolai Truan' || foundItem.OwnerName == 'Joseph Link'){
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Bears.png';
                        // }
                        // if(foundItem.OwnerName == 'Marcus Hudon'){
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Eagles.png';
                        // }
                        // if(foundItem.OwnerName == 'Zachary Deayton'){
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Sharks.png';
                        // }
                        // if(foundItem.OwnerName == 'Darren Brennan'){
                        //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Wildcats.png';
                        // }
                    }
                });
                
                // Fetch Sales Order data to get Sell to Customer Account Owner information
                if(this.SOIds.length > 0){
                    getSOs({SOIds: this.SOIds}).then((result) => {
                        this.records = this.records.map(itm => {
                            if(result[itm.SOId]) {
                                const soData = result[itm.SOId];
                                if(soData.GFERP__Document_Status__c == 'All Shipped'){
                                    itm.isAllShipped = true;
                                } else {
                                    itm.isAllShipped = false;
                                }
                                // Set the Sell to Customer Account Owner name
                                if(soData.GFERP__Sell_to_Customer__r && soData.GFERP__Sell_to_Customer__r.Owner) {
                                    itm.SellToCustomerOwnerName = soData.GFERP__Sell_to_Customer__r.Owner.Name;
                                }
                            }
                            return itm;
                        });
                        this.records = [...this.records];
                        this.handleUpdateTable();
                    }).catch((error) => {
                        console.log('Error fetching SO data:', error);
                        this.handleUpdateTable();
                    })
                } else {
                    this.handleUpdateTable();
                }
            }).catch(error => {
                this.handleUpdateTable();
            });
        }
        if (error) {
            console.error(error)
        }
    }

    get filteredRecords(){
        let filteredData = this.records;
        
        // Filter by currency
        if(this.currencyValue != 'All') {
            filteredData = filteredData.filter(ele => {
               return ele.currency == this.currencyValue;
            });
        }
        
        // Filter by Account Owner (from Sell to Customer on Sales Order)
        if(this.selectedUser != "" && this.selectedUser != null){
            filteredData = filteredData.filter(ele => {
                // Check if there's a Sales Order with Sell to Customer Account Owner
                if(ele.SOId && ele.SellToCustomerOwnerName) {
                    return this.selectedUser.includes(ele.SellToCustomerOwnerName);
                }
                // If no Sales Order, fall back to Opportunity Owner (optional behavior)
                // You can remove this fallback if you only want to show records with Sales Orders
                return this.selectedUser.includes(ele.OwnerName);
            });
        }
        
        return filteredData;
    }
    handleStartingDate(event) {
        this.startingDate = event.target.value;
    }

    handleWeekNo(event) {
        this.WeekNo = event.target.value;
    }

    handleReturn(event) {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Production_Week_Setup__c',
                actionName: 'list'
            },
            state: {
                filterName: 'Recent'
            },
        });

    }

    handleUpdateTable(event) {
        this.selectedUser = this.template.querySelector('[role="cm-picklist"]').getSelectedList();
        getProductionSchedulingByDate({ startDate: this.startingDate, numberOfWeeks: this.WeekNo, oppIdsStr:  this.oppIds, usersName: this.selectedUser.split(';')}).then((result) => {
            this.PSList = result;
            this.pickVals = [];

            function getMondayOfISOWeek(week, year) {
                const simple = new Date(year, 0, 1 + (week - 1) * 7);
                const dow = simple.getDay();
                if (dow <= 4)
                    simple.setDate(simple.getDate() - simple.getDay() + 1);
                else
                    simple.setDate(simple.getDate() + 8 - simple.getDay());
                return simple;
            }
            /*this.pickVals.push({
                wNo: 'Commitment',
                total: 0,
                leftOver: 0,
                goal: 0,
                goalCAD: 0,
                goalUSD: 0,
                PP: 0,
                isDisplayAmounts: false,
                columnHeaderColor: 'column_heading column_heading_defaul'
            });*/
            /*c/croi_verticalButtonNavthis.pickVals.push({
                wNo: 'Closed Won',
                total: 0,
                leftOver: 0,
                goal: 0,
                goalCAD: 0,
                goalUSD: 0,
                PP: 0,
                isDisplayAmounts: false,
                columnHeaderColor: 'column_heading column_heading_defaul'
            });*/
            /*this.pickVals.push({
                wNo: 'Forecast',
                total: 0,
                leftOver: 0,
                goal: 0,
                goalCAD: 0,
                goalUSD: 0,
                PP: 0,
                isDisplayAmounts: false,
                columnHeaderColor: 'column_heading column_heading_defaul'
            });
            this.pickVals.push({
                wNo: 'Closed Lost',
                total: 0,
                leftOver: 0,
                goal: 0,
                goalCAD: 0,
                goalUSD: 0,
                PP: 0,
                isDisplayAmounts: false,
                columnHeaderColor: 'column_heading column_heading_defaul'
            });*/

            function formatDate(date) {
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit'
                });
            }

            result.forEach(item => {
                let totalAmount = 0;
                let totalUSDAmount = 0;
                let totalCADAmount = 0;
                let approvedDealerAmount = 0;
                let approvedDealerUSAAmount = 0;
                let approvedDealerCADAmount = 0;
                if (item.Opportunities__r) {
                    item.Opportunities__r.forEach(opp => {
                        totalAmount += (opp.Amount__c ? opp.Amount__c : 0);
                        if(opp.CurrencyIsoCode == 'USD'){
                            totalUSDAmount += (opp.Amount__c ? opp.Amount__c : 0);
                        }
                        if(opp.CurrencyIsoCode == 'CAD'){
                            totalCADAmount += (opp.Amount__c ? opp.Amount__c : 0);
                        }
                        const foundItem = this.records.find(item => item.Id === opp.Id);
                        if(foundItem){
                            foundItem.OwnerName = opp.Owner.Name;
                            //foundItem.isTeamLogo = true;
                            // if(opp.Owner.Team__c){
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/' + opp.Owner.Team__c + '.png';
                            // }
                            // if(foundItem.OwnerName == 'Jotham Deayton'){//'Dale Cornell') {
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Coyotes.png';
                            // }
                            // if(foundItem.OwnerName == 'Anthony Truan'){
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Bears.png';
                            // }
                            // if(foundItem.OwnerName == 'Marcus Hudon'){
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Eagles.png';
                            // }
                            // if(foundItem.OwnerName == 'Zachary Deayton'){
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Sharks.png';
                            // }
                            // if(foundItem.OwnerName == 'Darren Brennan'){
                            //     foundItem.TeamLogoURL = this.GF_Team_Logos + '/GF_Team_Logos/Wildcats.png';
                            // }
                        }
                        if(opp.SyncedQuote && opp.SyncedQuote.Status){
                            if(opp.SyncedQuote.Status == 'Approved by Dealer'){
                                approvedDealerAmount += opp.Amount__c;
                                if(opp.CurrencyIsoCode == 'USD'){
                                    approvedDealerUSAAmount += (opp.Amount__c ? opp.Amount__c : 0);
                                }
                                if(opp.CurrencyIsoCode == 'CAD'){
                                    approvedDealerCADAmount += (opp.Amount__c ? opp.Amount__c : 0);
                                }
                            }
                        }
                    })
                }
                function getMonday(date) {
                    const d = new Date(date);
                    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
                    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when Sunday
                    return new Date(d.setDate(diff));
                }

                const productionWeekStr = item.Production_Week__c; // e.g., '2025-07-07'
                const productionDate = getMonday(productionWeekStr);// Monday of that week

                const getISOWeekAndYear = (date) => {
                const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const year = d.getUTCFullYear();
                const jan1 = new Date(Date.UTC(year, 0, 1));
                const weekNum = Math.ceil((((d - jan1) / 86400000) + 1) / 7);
                return { weekNum, year };
                };

                const { weekNum, year } = getISOWeekAndYear(productionDate);
                const shipWeek = new Date(productionDate);
                shipWeek.setDate(shipWeek.getDate() + 7);

                const lastChangeDate = new Date(productionDate);
                lastChangeDate.setDate(lastChangeDate.getDate() - 28);
                // Format dates as yyyy-mm-dd
                const formatDate = (date) => date.toISOString().split('T')[0];

                let weekNumber = (item.Name != undefined? 'Week ' + item.Name.split('/')[1]: '');
                this.pickVals.push({
                    wNo: item.Name,
                    weekNumber: weekNumber,//,
                    total: totalAmount, //(item.Total_Amount__c != null ? item.Total_Amount__c : 0),
                    totalUSD: totalUSDAmount,
                    totalCAD: totalCADAmount,
                    leftOver: item.Goal_Amount_1__c - totalAmount,//(item.Leftover_Amount__c != null ? item.Leftover_Amount__c : 0),
                    leftOverUSD: /*item.Goal_Amount_1__c*/ (item.Goal_Amount__c * this.currencyExchange[0].ConversionRate) - totalUSDAmount,//(item.Leftover_Amount__c != null ? item.Leftover_Amount__c : 0),
                    leftOverCAD: item.Goal_Amount__c - totalCADAmount,//(item.Leftover_Amount__c != null ? item.Leftover_Amount__c : 0),
                    goal: (item.Goal_Amount_1__c != null ? item.Goal_Amount_1__c : 0),//
                    goalCAD: (item.Goal_Amount_1__c != null ? item.Goal_Amount_1__c : 0),//(item.Goal_Amount__c != null ? item.Goal_Amount__c : 0),
                    goalUSD: (item.Goal_Amount_1__c != null ? item.Goal_Amount_1__c : 0),//(item.Goal_Amount__c != null ? item.Goal_Amount__c * this.currencyExchange[0].ConversionRate : 0),
                    PP: (item.Load_Goal__c != null ? item.Load_Goal__c : 0),
                    isDisplayAmounts: true,
                    approvedDealerAmount: approvedDealerAmount,
                    approvedDealerUSAAmount: approvedDealerUSAAmount,
                    approvedDealerCADAmount: approvedDealerCADAmount,
                    seDates: this.getFormattedDate(item.Week_Start_Date__c),// + ' / ' + this.getFormattedDate(item.Week_End_Date__c),
                    productionDateFormatted: this.getFormattedDate(productionDate),
                    lastChangeDateFormatted: this.getFormattedDate(lastChangeDate),
                    shipWeekDateFormatted: this.getFormattedDate(shipWeek),
                    columnHeaderColor: ((item.Goal_Amount_1__c - totalAmount) < 0 ? 'column_heading column_heading_orange' : 'column_heading column_heading_defaul')
                });
            });
            /*this.pickVals = result.map(item => {
                return {
                    wNo: item.Name,
                    total: (item.Total_Amount__c != null ? item.Total_Amount__c : 0),
                    leftOver: (item.Leftover_Amount__c != null ? item.Leftover_Amount__c : 0),
                    goal: (item.Goal_Amount__c != null ? item.Goal_Amount__c : 0),
                    columnHeaderColor: (item.Leftover_Amount__c < 0 ? 'column_heading column_heading_orange' : 'column_heading column_heading_defaul')
                }
            });*/
            console.log('this.GF_Team_Logos ', this.GF_Team_Logos);
            this.pickVals = [...this.pickVals];
        }).catch(error => {
            console.log(JSON.stringify(error));
            this.isLoading = false;
            //this.showErrorToast(error);
        });
    }
    getFormattedDate(dateStr) {
        const monthName = ["January","February","March","April","May","June","July","August","September","October","November","December"];

        if(dateStr && dateStr != ''){
            let date = new Date(dateStr);
            var year = date.getFullYear().toString().substr(-2);
            var month = (1 + date.getMonth()).toString();
            month = month.length > 1 ? month : '0' + month;
            var day = date.getDate().toString();
            day = day.length > 1 ? day : '0' + day;
            return monthName[date.getMonth()] + ' ' + day + ', ' + year;
        }
        return '';
    }
    /** Fetch metadata abaout the opportunity object**/
    @wire(getObjectInfo, { objectApiName: OPPORTUNITY_OBJECT })
    objectInfo({ error, data }) {
        if (data) {
            // Find the Record Type ID based on the record type name (DeveloperName)
            const recordTypes = data.recordTypeInfos;
            const recordTypeInfo = Object.values(recordTypes).find(rt => rt.name === "Dealer Loads");
            if (recordTypeInfo) {
                this.recordTypeId = recordTypeInfo.recordTypeId;
                console.log('Record Type ID:', this.recordTypeId);
            }
        } else if (error) {
            console.error('Error fetching object info:', error);
        }
    }
    /*** fetching Stage Picklist ***/

    /*@wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STAGE_FIELD
    }) stagePicklistValues({ data, error }) {
        if (data) {
            //this.pickVals = data.values.map(item => item.value)
        }
        if (error) {
            console.error(error)
        }
    }*/


    /****getter to calculate the  width dynamically*/
    get calcWidth() {
        let len = this.pickVals.length + 1
        return `width: calc(100vw/ ${len})`
    }

    handleListItemDrag(event) {
        this.recordId = event.detail
    }
    showSpinner = false;
    handleItemDrop(event) {
        this.showSpinner = true;
        let stage = event.detail
        // this.records = this.records.map(item=>{
        //     return item.Id === this.recordId ? {...item, StageName:stage}:{...item}
        // })
        this.updateHandler(stage)
    }
    oppStages = ['Commitment', 'Closed Won'];
    updateHandler(stage) {
        const fields = {};
        fields[ID_FIELD.fieldApiName] = this.recordId;
        if (this.oppStages.includes(stage)) {
            fields[STAGE_FIELD.fieldApiName] = stage;
            fields[PRODUCTION_SCHEDULING_FIELD.fieldApiName] = null;
        } else {
            var psId;
            this.PSList.forEach(element => {
                if (element.Name == stage) {
                    psId = element.Id;
                }
            });

            fields[PRODUCTION_SCHEDULING_FIELD.fieldApiName] = psId;
        }




        const recordInput = { fields }
        updateRecord(recordInput)
            .then(() => {
                console.log("Updated Successfully")
                this.handleUpdateTable(null);
                this.showToast();
                this.showSpinner = false;
                return refreshApex(this.wiredListView);
                // updatePSTotal().then(() => {

                // }).catch(error => {
                //     console.error(error)
                // })

            }).catch(error => {
                console.error(error)
            })
    }

    showToast() {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Week updated Successfully',
                variant: 'success'
            })
        )
    }

    handleUserSelectionChange(event){
        this.selectedUser = event.detail.value;
    }

    handleNewOpp() {
        var pageRef = {
            type: "standard__objectPage",
            attributes: {
                objectApiName: 'Opportunity',
                actionName: 'new'
            },
            state: {
                "recordTypeId": this.recordTypeId
            }
            // },
            // state: {
            //     recordId: '5007j00000C4bjFAAR',
            //     defaultFieldValues:
            //         encodeDefaultFieldValues({
            //             HtmlBody: "Pre-populated text for the body of the email.",
            //             Subject: "Pre = populated Subject of the Email"
            //         })
            // }
        };


        this[NavigationMixin.Navigate](pageRef);
    }
    
}