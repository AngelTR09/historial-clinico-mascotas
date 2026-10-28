export class AdaptadorNotificacionConsola {
    async notify(input) {
        console.log(`[notify] ${input.template} -> ${input.to}`, input.data);
    }
}
