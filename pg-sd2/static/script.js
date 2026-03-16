document.addEventListener("DOMContentLoaded", () => {

console.log("Circular Fashion Loaded");

/* Sticky Header Shadow */

const header = document.querySelector(".site-header");

window.addEventListener("scroll", () => {

if(window.scrollY > 50){
header.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
}
else{
header.style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)";
}

});


/* Scroll Animation */

const cards = document.querySelectorAll(".service-card");

function revealCards(){

cards.forEach(card =>{

const cardTop = card.getBoundingClientRect().top;

if(cardTop < window.innerHeight - 50){
card.style.opacity = "1";
card.style.transform = "translateY(0)";
}

});

}

window.addEventListener("scroll", revealCards);
revealCards();


/* Button interaction */

const buttons = document.querySelectorAll(".btn.primary");

buttons.forEach(btn =>{

btn.addEventListener("click", () =>{

console.log("User clicked CTA button");

});

});

});