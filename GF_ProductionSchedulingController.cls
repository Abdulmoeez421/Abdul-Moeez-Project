public with sharing class GF_ProductionSchedulingController {
    
    @AuraEnabled(cacheable=true)
    public static List<Production_Week_Setup__c> getProductionSchedulingByDate(Date startDate, Integer numberOfWeeks, String oppIdsStr, List<String> usersName) {
        // Implementation for getting production scheduling data
        // This method should remain as is from your original code
        return new List<Production_Week_Setup__c>();
    }
    
    @AuraEnabled(cacheable=true)
    public static List<CurrencyType> getCurrencyTypes() {
        // Implementation for getting currency types
        // This method should remain as is from your original code
        return new List<CurrencyType>();
    }
    
    @AuraEnabled(cacheable=true)
    public static Map<Id, GFERP__Sales_Order__c> getSOs(List<Id> SOIds) {
        Map<Id, GFERP__Sales_Order__c> soMap = new Map<Id, GFERP__Sales_Order__c>();
        
        if (SOIds != null && !SOIds.isEmpty()) {
            // Query Sales Orders with Sell to Customer Account Owner information
            List<GFERP__Sales_Order__c> salesOrders = [
                SELECT Id, 
                       GFERP__Document_Status__c,
                       GFERP__Sell_to_Customer__c,
                       GFERP__Sell_to_Customer__r.Id,
                       GFERP__Sell_to_Customer__r.Name,
                       GFERP__Sell_to_Customer__r.Owner.Id,
                       GFERP__Sell_to_Customer__r.Owner.Name
                FROM GFERP__Sales_Order__c 
                WHERE Id IN :SOIds
                WITH SECURITY_ENFORCED
            ];
            
            for (GFERP__Sales_Order__c so : salesOrders) {
                soMap.put(so.Id, so);
            }
        }
        
        return soMap;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<User> getAllUsers() {
        // Implementation for getting all users
        // This method should remain as is from your original code
        return [SELECT Id, Name FROM User WHERE IsActive = true WITH SECURITY_ENFORCED ORDER BY Name];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpp(List<Id> oppIds) {
        // Implementation for getting opportunities with owner information
        // This method should remain as is from your original code
        return [SELECT Id, Owner.Id, Owner.Name FROM Opportunity WHERE Id IN :oppIds WITH SECURITY_ENFORCED];
    }
}