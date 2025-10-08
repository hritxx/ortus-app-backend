#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
TOKEN=""
USER_ID=""

echo "================================"
echo "Ortus Finance API Test Suite"
echo "================================"
echo ""

register_and_login() {
    echo "1. Testing User Registration..."
    REGISTER_EMAIL="test$(date +%s)@test.com"
    curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$REGISTER_EMAIL\",\"password\":\"Test@123\",\"name\":\"Test User\",\"phone\":\"+919999999999\"}" | python3 -m json.tool
    echo ""
    
    echo "2. Testing Login..."
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"demo@ortusfinance.com","password":"Test@123"}')
    
    TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('accessToken', ''))")
    USER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))")
    
    if [ -z "$TOKEN" ]; then
        echo "Login failed. Exiting..."
        exit 1
    fi
    echo "Login successful!"
    echo ""
}

test_auth_endpoints() {
    echo "3. Testing Get Profile..."
    curl -s -X GET "$BASE_URL/auth/profile" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "4. Testing Get Me..."
    curl -s -X GET "$BASE_URL/auth/me" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "5. Testing Update Profile..."
    curl -s -X PUT "$BASE_URL/auth/profile" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"Updated Name","address":"New Address"}' | python3 -m json.tool
    echo ""
}

test_investment_endpoints() {
    echo "6. Testing Get Investment Plans..."
    PLANS_RESPONSE=$(curl -s -X GET "$BASE_URL/investments/plans" \
        -H "Authorization: Bearer $TOKEN")
    echo $PLANS_RESPONSE | python3 -m json.tool
    PLAN_ID=$(echo $PLANS_RESPONSE | python3 -c "import sys, json; plans = json.load(sys.stdin).get('plans', []); print(plans[0]['id'] if plans else '')")
    echo ""
    
    echo "7. Testing Get Single Plan..."
    curl -s -X GET "$BASE_URL/investments/plans/$PLAN_ID" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "8. Testing Get My Investments..."
    curl -s -X GET "$BASE_URL/investments/my" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "9. Testing Get Portfolio..."
    curl -s -X GET "$BASE_URL/investments/portfolio" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "10. Testing Get Transactions..."
    curl -s -X GET "$BASE_URL/investments/transactions" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
}

test_notification_endpoints() {
    echo "11. Testing Get Notifications..."
    curl -s -X GET "$BASE_URL/notifications" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "12. Testing Get Unread Count..."
    curl -s -X GET "$BASE_URL/notifications/unread-count" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
    
    echo "13. Testing Mark All As Read..."
    curl -s -X PATCH "$BASE_URL/notifications/read-all" \
        -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
    echo ""
}

test_payment_endpoints() {
    echo "14. Testing Create Payment Order..."
    curl -s -X POST "$BASE_URL/payment/create-order" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"amount":10000,"currency":"INR","planId":"test-plan-id"}' | python3 -m json.tool
    echo ""
}

register_and_login
test_auth_endpoints
test_investment_endpoints
test_notification_endpoints
test_payment_endpoints

echo "================================"
echo "Test Suite Complete!"
echo "================================"
